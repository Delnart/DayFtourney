require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
  StringSelectMenuBuilder, InteractionType, EmbedBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { processMatchResult } = require('./bracketEngine');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'tournament.json');

function loadData() { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
function saveData(d) { fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2), 'utf8'); }

// ---- Permission helper ----
function hasAdminRole(member, data) {
  const allowedRoles = data.config.adminRoleIds || [];
  if (allowedRoles.length === 0) return true; // No roles configured yet → allow all
  return allowedRoles.some(rid => member.roles.cache.has(rid));
}

// ---- Embeds ----
function matchEmbed(match, stage) {
  const t1 = match.team1?.name ?? 'TBD';
  const t2 = match.team2?.name ?? 'TBD';
  const state = match.state === 'finished'
    ? `✅ **${match.winnerId === match.team1?.id ? t1 : t2}** won (${match.score1}:${match.score2})`
    : `⏳ ${match.state.toUpperCase()}`;

  return new EmbedBuilder()
    .setTitle(`[${match.bracket}] ${match.roundName}`)
    .setDescription(`**${t1}** vs **${t2}**\n\n${state}`)
    .setColor(match.state === 'finished' ? 0x50C878 : match.bracket === 'LB' ? 0xf59e0b : 0x8b5cf6)
    .addFields(
      { name: 'Match ID', value: match.id, inline: true },
      { name: 'Stage', value: stage, inline: true },
      { name: 'Format', value: `BO${match.bo || 1}`, inline: true },
      ...(match.scheduledDate ? [{ name: 'Scheduled', value: match.scheduledDate, inline: true }] : []),
      ...(match.nextWinMatchId ? [{ name: 'Winner → ', value: match.nextWinMatchId, inline: true }] : []),
      ...(match.nextLoseMatchId ? [{ name: 'Loser → LB', value: match.nextLoseMatchId, inline: true }] : []),
    )
    .setFooter({ text: 'Day F 2026 Tournament' })
    .setTimestamp();
}

// ---- Bot ----
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`Bot ready: ${client.user.tag}`);
});

// ---- Slash command handler ----
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

  const data = loadData();

  // =========================================================
  // /team add
  // =========================================================
  if (interaction.isChatInputCommand() && interaction.commandName === 'team' && interaction.options.getSubcommand() === 'add') {
    if (!hasAdminRole(interaction.member, data)) {
      return interaction.reply({ content: '❌ No permission.', ephemeral: true });
    }
    const modal = new ModalBuilder().setCustomId('modal_team_add').setTitle('➕ Add Team');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('team_name').setLabel('Team Name').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('team_logo').setLabel('Logo URL (optional)').setStyle(TextInputStyle.Short).setRequired(false)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('team_day').setLabel('Qualifier Day (e.g. 25.04)').setStyle(TextInputStyle.Short).setRequired(false)),
    );
    await interaction.showModal(modal);
  }

  // /team add modal submit
  if (interaction.isModalSubmit() && interaction.customId === 'modal_team_add') {
    const data = loadData();
    if (!hasAdminRole(interaction.member, data)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
    const name = interaction.fields.getTextInputValue('team_name').trim();
    const logoUrl = interaction.fields.getTextInputValue('team_logo').trim() || null;
    const day = interaction.fields.getTextInputValue('team_day').trim() || null;
    const teamId = `team_${Date.now()}`;
    data.teams[teamId] = { id: teamId, name, logoUrl, day };
    saveData(data);
    await interaction.reply({ content: `✅ Team **${name}** added! (ID: \`${teamId}\`, Day: ${day || 'N/A'})`, ephemeral: true });
  }

  // =========================================================
  // /team list
  // =========================================================
  if (interaction.isChatInputCommand() && interaction.commandName === 'team' && interaction.options.getSubcommand() === 'list') {
    const data = loadData();
    const teams = Object.values(data.teams);
    if (teams.length === 0) return interaction.reply({ content: '📋 No teams yet.', ephemeral: true });
    const list = teams.map((t, i) => `${i + 1}. **${t.name}** \`${t.id}\` — Day: ${t.day || 'N/A'}`).join('\n');
    await interaction.reply({ content: `📋 **Teams (${teams.length}):**\n${list}`, ephemeral: true });
  }

  // =========================================================
  // /tournament generate stage1|stage2
  // =========================================================
  if (interaction.isChatInputCommand() && interaction.commandName === 'tournament' && interaction.options.getSubcommand() === 'generate') {
    if (!hasAdminRole(interaction.member, data)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
    const stage = interaction.options.getString('stage');
    await interaction.deferReply({ ephemeral: true });

    try {
      const fetch = (await import('node-fetch')).default;
      const res = await fetch(`http://localhost:${process.env.PORT || 3001}/api/tournament/generate/${stage}`, {
        method: 'POST',
        headers: { 'x-api-key': process.env.API_SECRET || '' }
      });
      const json = await res.json();
      if (json.success) {
        await interaction.editReply(`✅ **${stage}** bracket generated!\nTeams: ${json.teamCount}, Bracket size: ${json.bracketSize}, Matches: ${json.matchCount}`);
      } else {
        await interaction.editReply(`❌ Error: ${json.error}`);
      }
    } catch (e) {
      await interaction.editReply(`❌ Failed: ${e.message}`);
    }
  }

  // =========================================================
  // /tournament reset
  // =========================================================
  if (interaction.isChatInputCommand() && interaction.commandName === 'tournament' && interaction.options.getSubcommand() === 'reset') {
    if (!hasAdminRole(interaction.member, data)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
    const d = loadData();
    d.teams = {};
    d.stage1 = { generated: false, matches: {}, rounds: [] };
    d.stage2 = { generated: false, matches: {}, rounds: [] };
    saveData(d);
    await interaction.reply({ content: '🗑️ Tournament reset.', ephemeral: true });
  }

  // =========================================================
  // /match result — Step 1: show stage select
  // =========================================================
  if (interaction.isChatInputCommand() && interaction.commandName === 'match' && interaction.options.getSubcommand() === 'result') {
    if (!hasAdminRole(interaction.member, data)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });

    const modal = new ModalBuilder().setCustomId('modal_match_result').setTitle('🏆 Set Match Result');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('mr_stage').setLabel('Stage (stage1 or stage2)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('stage1')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('mr_matchid').setLabel('Match ID (e.g. ub_r1_m1)').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('mr_winner').setLabel('Winner Team Name (partial ok)').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('mr_score').setLabel('Score (e.g. 2:1 or 1:0)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('2:1')
      ),
    );
    await interaction.showModal(modal);
  }

  // /match result modal submit
  if (interaction.isModalSubmit() && interaction.customId === 'modal_match_result') {
    const d = loadData();
    if (!hasAdminRole(interaction.member, d)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });

    const stage = interaction.fields.getTextInputValue('mr_stage').trim();
    const matchId = interaction.fields.getTextInputValue('mr_matchid').trim();
    const winnerInput = interaction.fields.getTextInputValue('mr_winner').trim().toLowerCase();
    const scoreRaw = interaction.fields.getTextInputValue('mr_score').trim();

    const stageData = d[stage];
    if (!stageData?.generated) return interaction.reply({ content: `❌ Stage "${stage}" not generated.`, ephemeral: true });

    const match = stageData.matches[matchId];
    if (!match) return interaction.reply({ content: `❌ Match ID "${matchId}" not found.`, ephemeral: true });

    // Find winner by name
    const t1 = match.team1, t2 = match.team2;
    let winner = null;
    if (t1 && t1.name.toLowerCase().includes(winnerInput)) winner = t1;
    else if (t2 && t2.name.toLowerCase().includes(winnerInput)) winner = t2;
    if (!winner) return interaction.reply({ content: `❌ Could not find team matching "${winnerInput}" in this match.`, ephemeral: true });

    const [s1, s2] = scoreRaw.split(':').map(Number);

    try {
      const updated = processMatchResult(stageData, matchId, winner.id, s1 ?? null, s2 ?? null);
      d[stage] = updated;
      saveData(d);

      const resultMatch = d[stage].matches[matchId];
      const embed = matchEmbed(resultMatch, stage);

      // Post to results channel if configured
      const resultsChannelId = process.env.RESULTS_CHANNEL_ID;
      if (resultsChannelId) {
        const channel = client.channels.cache.get(resultsChannelId);
        if (channel) await channel.send({ embeds: [embed] });
      }

      await interaction.reply({ embeds: [embed], ephemeral: false });
    } catch (e) {
      await interaction.reply({ content: `❌ Error: ${e.message}`, ephemeral: true });
    }
  }

  // =========================================================
  // /match schedule — set match date
  // =========================================================
  if (interaction.isChatInputCommand() && interaction.commandName === 'match' && interaction.options.getSubcommand() === 'schedule') {
    if (!hasAdminRole(interaction.member, data)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
    const modal = new ModalBuilder().setCustomId('modal_match_schedule').setTitle('📅 Schedule Match');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ms_stage').setLabel('Stage (stage1 or stage2)').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ms_matchid').setLabel('Match ID').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ms_date').setLabel('Date (e.g. 25.04 18:00)').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ms_bo').setLabel('BO format (1 or 3)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('1')),
    );
    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'modal_match_schedule') {
    const d = loadData();
    if (!hasAdminRole(interaction.member, d)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
    const stage = interaction.fields.getTextInputValue('ms_stage').trim();
    const matchId = interaction.fields.getTextInputValue('ms_matchid').trim();
    const date = interaction.fields.getTextInputValue('ms_date').trim();
    const bo = parseInt(interaction.fields.getTextInputValue('ms_bo').trim()) || undefined;

    const match = d[stage]?.matches?.[matchId];
    if (!match) return interaction.reply({ content: '❌ Match not found.', ephemeral: true });
    match.scheduledDate = date;
    if (bo) match.bo = bo;
    saveData(d);
    await interaction.reply({ content: `✅ Match \`${matchId}\` scheduled for **${date}** (BO${match.bo}).`, ephemeral: true });
  }

  // =========================================================
  // /config roles — set admin role IDs
  // =========================================================
  if (interaction.isChatInputCommand() && interaction.commandName === 'config' && interaction.options.getSubcommand() === 'roles') {
    const d = loadData();
    const roleIds = interaction.options.getString('role_ids').split(',').map(r => r.trim()).filter(Boolean);
    d.config.adminRoleIds = roleIds;
    saveData(d);
    await interaction.reply({ content: `✅ Admin roles set: ${roleIds.map(r => `<@&${r}>`).join(', ')}`, ephemeral: true });
  }
});

// ---- Register commands ----
const commands = [
  new SlashCommandBuilder().setName('team').setDescription('Manage teams')
    .addSubcommand(s => s.setName('add').setDescription('Add a team'))
    .addSubcommand(s => s.setName('list').setDescription('List all teams')),

  new SlashCommandBuilder().setName('match').setDescription('Manage matches')
    .addSubcommand(s => s.setName('result').setDescription('Set match result'))
    .addSubcommand(s => s.setName('schedule').setDescription('Schedule a match')),

  new SlashCommandBuilder().setName('tournament').setDescription('Tournament management')
    .addSubcommand(s => s.setName('generate').setDescription('Generate bracket')
      .addStringOption(o => o.setName('stage').setDescription('stage1 or stage2').setRequired(true)
        .addChoices({ name: 'Stage 1 (Qualifiers)', value: 'stage1' }, { name: 'Stage 2 (Main Event)', value: 'stage2' })))
    .addSubcommand(s => s.setName('reset').setDescription('Reset all tournament data')),

  new SlashCommandBuilder().setName('config').setDescription('Bot configuration')
    .addSubcommand(s => s.setName('roles').setDescription('Set admin role IDs (comma-separated)')
      .addStringOption(o => o.setName('role_ids').setDescription('Role IDs').setRequired(true))),
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('Commands registered!');
  } catch (e) {
    console.error('Failed to register commands:', e);
  }
}

async function start() {
  await client.login(process.env.BOT_TOKEN);
  await registerCommands();
}

start();
