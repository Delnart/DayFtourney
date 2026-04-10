"""Tournament cog — /tournament generate, reset, status, config"""

import nextcord
from nextcord.ext import commands
from nextcord import Interaction, SlashOption

from utils import api_client, embeds


class TournamentCog(commands.Cog):
    def __init__(self, bot: commands.Bot, admin_role_ids: list[int]):
        self.bot = bot
        self.admin_role_ids = admin_role_ids

    def is_admin(self, member: nextcord.Member) -> bool:
        if not self.admin_role_ids:
            return True
        return any(r.id in self.admin_role_ids for r in member.roles)

    @nextcord.slash_command(name="tournament", description="Tournament management")
    async def tournament(self, interaction: Interaction):
        pass

    @tournament.subcommand(name="generate", description="Auto-generate bracket from registered teams")
    async def tournament_generate(
        self,
        interaction: Interaction,
        stage: str = SlashOption(
            description="Which stage to generate",
            choices={"Stage 1 (Qualifiers)": "stage1", "Stage 2 (Main Event)": "stage2"},
            required=True,
        ),
    ):
        if not self.is_admin(interaction.user):
            return await interaction.response.send_message(
                embed=embeds.error_embed("You don't have permission to generate brackets."),
                ephemeral=True,
            )
        await interaction.response.defer(ephemeral=True)
        try:
            result = await api_client.generate_bracket(stage)
            msg = (
                f"✅ **{stage}** bracket generated!\n\n"
                f"👥 Teams: `{result.get('teamCount', '?')}`\n"
                f"📦 Bracket size: `{result.get('bracketSize', 'auto')}`\n"
                f"🎮 Matches: `{result.get('matchCount', '?')}`"
            )
            await interaction.followup.send(embed=embeds.success_embed(msg), ephemeral=True)
        except Exception as e:
            await interaction.followup.send(embed=embeds.error_embed(str(e)), ephemeral=True)

    @tournament.subcommand(name="status", description="Show current tournament statistics")
    async def tournament_status(self, interaction: Interaction):
        await interaction.response.defer(ephemeral=False)
        try:
            data = await api_client.get_tournament()
            teams = list(data.get("teams", {}).values())

            s1 = data.get("stage1", {})
            s2 = data.get("stage2", {})

            s1_matches = list(s1.get("matches", {}).values())
            s1_done = sum(1 for m in s1_matches if m.get("state") == "finished")

            s2_matches = list(s2.get("matches", {}).values())
            s2_done = sum(1 for m in s2_matches if m.get("state") == "finished")

            embed = nextcord.Embed(
                title=f"📊 {data['config']['name']} — Status",
                color=0x8B5CF6,
            )
            embed.add_field(name="👥 Teams registered", value=str(len(teams)), inline=True)
            embed.add_field(
                name="Stage 1",
                value=f"{'✅ Generated' if s1.get('generated') else '⏳ Not started'}\n{s1_done}/{len(s1_matches)} matches done",
                inline=True,
            )
            embed.add_field(
                name="Stage 2",
                value=f"{'✅ Generated' if s2.get('generated') else '⏳ Not started'}\n{s2_done}/{len(s2_matches)} matches done",
                inline=True,
            )
            embed.set_footer(text="Day F 2026 Tournament")
            await interaction.followup.send(embed=embed)
        except Exception as e:
            await interaction.followup.send(embed=embeds.error_embed(str(e)))

    @tournament.subcommand(name="reset", description="⚠️ RESET all tournament data")
    async def tournament_reset(self, interaction: Interaction):
        if not self.is_admin(interaction.user):
            return await interaction.response.send_message(
                embed=embeds.error_embed("You don't have permission to reset the tournament."),
                ephemeral=True,
            )

        # Confirmation step
        confirm_embed = nextcord.Embed(
            title="⚠️ Confirm Reset",
            description="This will **delete all teams, matches and bracket data**.\nAre you sure?",
            color=0xE75A4D,
        )
        view = ConfirmResetView(interaction.user.id)
        await interaction.response.send_message(embed=confirm_embed, view=view, ephemeral=True)
        await view.wait()

        if view.confirmed:
            try:
                await api_client.reset_tournament()
                await interaction.edit_original_message(
                    embed=embeds.success_embed("🗑️ Tournament has been reset."), view=None
                )
            except Exception as e:
                await interaction.edit_original_message(
                    embed=embeds.error_embed(str(e)), view=None
                )
        else:
            await interaction.edit_original_message(
                embed=embeds.success_embed("Reset cancelled."), view=None
            )

    @tournament.subcommand(name="config_roles", description="Set which roles can manage the tournament")
    async def tournament_config_roles(
        self,
        interaction: Interaction,
        role_ids: str = SlashOption(
            description="Comma-separated role IDs (right-click role → Copy ID)",
            required=True,
        ),
    ):
        if not self.is_admin(interaction.user):
            return await interaction.response.send_message(
                embed=embeds.error_embed("No permission."), ephemeral=True
            )
        await interaction.response.defer(ephemeral=True)
        ids = [r.strip() for r in role_ids.split(",") if r.strip()]
        try:
            await api_client.update_config({"adminRoleIds": ids})
            # Update local cog state
            self.admin_role_ids = [int(i) for i in ids if i.isdigit()]
            mentions = " ".join(f"<@&{i}>" for i in ids)
            await interaction.followup.send(
                embed=embeds.success_embed(f"Admin roles updated: {mentions}"), ephemeral=True
            )
        except Exception as e:
            await interaction.followup.send(embed=embeds.error_embed(str(e)), ephemeral=True)


class ConfirmResetView(nextcord.ui.View):
    def __init__(self, requester_id: int):
        super().__init__(timeout=30)
        self.confirmed = False
        self.requester_id = requester_id

    @nextcord.ui.button(label="Yes, Reset Everything", style=nextcord.ButtonStyle.danger)
    async def confirm(self, button: nextcord.ui.Button, interaction: Interaction):
        if interaction.user.id != self.requester_id:
            return await interaction.response.send_message("Not your button.", ephemeral=True)
        self.confirmed = True
        await interaction.response.defer()
        self.stop()

    @nextcord.ui.button(label="Cancel", style=nextcord.ButtonStyle.secondary)
    async def cancel(self, button: nextcord.ui.Button, interaction: Interaction):
        await interaction.response.defer()
        self.stop()


def setup(bot, admin_role_ids):
    bot.add_cog(TournamentCog(bot, admin_role_ids))
