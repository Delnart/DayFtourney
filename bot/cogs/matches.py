"""Matches cog — /match result, /match schedule, /match info"""

import os
import nextcord
from nextcord.ext import commands
from nextcord import Interaction, SlashOption
import nextcord.ui as ui

from utils import api_client, embeds


class MatchResultModal(ui.Modal):
    def __init__(self, bot: commands.Bot, admin_role_ids: list[int]):
        super().__init__("🏆 Set Match Result", timeout=300)
        self.bot = bot
        self.admin_role_ids = admin_role_ids

        self.stage_input = ui.TextInput(
            label="Stage (stage1 or stage2)",
            placeholder="stage2",
            min_length=6,
            max_length=6,
            required=True,
        )
        self.match_input = ui.TextInput(
            label="Match ID (e.g. ub_r1_m1)",
            required=True,
        )
        self.winner_input = ui.TextInput(
            label="Winner Team Name (partial match ok)",
            required=True,
        )
        self.score_input = ui.TextInput(
            label="Score (e.g. 2:1 or 1:0)",
            placeholder="2:1",
            required=True,
            max_length=10,
        )
        self.add_item(self.stage_input)
        self.add_item(self.match_input)
        self.add_item(self.winner_input)
        self.add_item(self.score_input)

    async def callback(self, interaction: Interaction):
        stage = self.stage_input.value.strip()
        match_id = self.match_input.value.strip()
        winner_input = self.winner_input.value.strip().lower()
        score_raw = self.score_input.value.strip()

        try:
            tournament = await api_client.get_tournament()
        except Exception as e:
            return await interaction.response.send_message(
                embed=embeds.error_embed(f"Could not fetch tournament: {e}"), ephemeral=True
            )

        stage_data = tournament.get(stage, {})
        if not stage_data.get("generated"):
            return await interaction.response.send_message(
                embed=embeds.error_embed(f'Stage "{stage}" is not generated yet.'), ephemeral=True
            )

        match = stage_data.get("matches", {}).get(match_id)
        if not match:
            return await interaction.response.send_message(
                embed=embeds.error_embed(f'Match `{match_id}` not found in {stage}.'), ephemeral=True
            )

        t1 = match.get("team1") or {}
        t2 = match.get("team2") or {}

        # Find winner by partial name match
        winner = None
        if t1.get("name", "").lower().find(winner_input) != -1:
            winner = t1
        elif t2.get("name", "").lower().find(winner_input) != -1:
            winner = t2

        if not winner:
            return await interaction.response.send_message(
                embed=embeds.error_embed(f'Could not find "{winner_input}" in this match. Teams: **{t1.get("name","?")}** vs **{t2.get("name","?")}**'),
                ephemeral=True,
            )

        # Parse score
        score1, score2 = None, None
        if ":" in score_raw:
            parts = score_raw.split(":")
            try:
                score1, score2 = int(parts[0]), int(parts[1])
            except ValueError:
                return await interaction.response.send_message(
                    embed=embeds.error_embed("Invalid score format. Use e.g. `2:1`"), ephemeral=True
                )

        await interaction.response.defer()

        try:
            result = await api_client.submit_match_result(stage, match_id, winner["id"], score1, score2)
            updated_match = result["match"]
            embed = embeds.match_embed(updated_match, stage)

            # Post to results channel
            results_channel_id = int(os.getenv("RESULTS_CHANNEL_ID", "0"))
            if results_channel_id:
                channel = self.bot.get_channel(results_channel_id)
                if channel:
                    await channel.send(embed=embed)

            await interaction.followup.send(embed=embed)
        except Exception as e:
            await interaction.followup.send(embed=embeds.error_embed(str(e)))


class MatchScheduleModal(ui.Modal):
    def __init__(self):
        super().__init__("📅 Schedule Match", timeout=300)

        self.stage_input = ui.TextInput(
            label="Stage (stage1 or stage2)",
            placeholder="stage2",
            required=True,
        )
        self.match_input = ui.TextInput(
            label="Match ID (e.g. ub_r2_m1)",
            required=True,
        )
        self.date_input = ui.TextInput(
            label="Date & Time (e.g. 25.04 18:00)",
            required=True,
        )
        self.bo_input = ui.TextInput(
            label="BO Format (1 or 3)",
            placeholder="1",
            required=False,
            max_length=1,
        )
        self.add_item(self.stage_input)
        self.add_item(self.match_input)
        self.add_item(self.date_input)
        self.add_item(self.bo_input)

    async def callback(self, interaction: Interaction):
        stage = self.stage_input.value.strip()
        match_id = self.match_input.value.strip()
        date = self.date_input.value.strip()
        bo_raw = self.bo_input.value.strip()
        bo = int(bo_raw) if bo_raw.isdigit() else None

        await interaction.response.defer(ephemeral=True)
        try:
            result = await api_client.schedule_match(stage, match_id, date, bo)
            match = result["match"]
            await interaction.followup.send(
                embed=embeds.success_embed(
                    f"Match `{match_id}` scheduled for **{match['scheduledDate']}** (BO{match['bo']})"
                ),
                ephemeral=True,
            )
        except Exception as e:
            await interaction.followup.send(embed=embeds.error_embed(str(e)), ephemeral=True)


class MatchesCog(commands.Cog):
    def __init__(self, bot: commands.Bot, admin_role_ids: list[int]):
        self.bot = bot
        self.admin_role_ids = admin_role_ids

    def is_admin(self, member: nextcord.Member) -> bool:
        if not self.admin_role_ids:
            return True
        return any(r.id in self.admin_role_ids for r in member.roles)

    @nextcord.slash_command(name="match", description="Manage tournament matches")
    async def match(self, interaction: Interaction):
        pass

    @match.subcommand(name="result", description="Enter match result (winner + score)")
    async def match_result(self, interaction: Interaction):
        if not self.is_admin(interaction.user):
            return await interaction.response.send_message(
                embed=embeds.error_embed("You don't have permission to enter results."),
                ephemeral=True,
            )
        await interaction.response.send_modal(
            MatchResultModal(self.bot, self.admin_role_ids)
        )

    @match.subcommand(name="schedule", description="Set match date and BO format")
    async def match_schedule(self, interaction: Interaction):
        if not self.is_admin(interaction.user):
            return await interaction.response.send_message(
                embed=embeds.error_embed("You don't have permission to schedule matches."),
                ephemeral=True,
            )
        await interaction.response.send_modal(MatchScheduleModal())

    @match.subcommand(name="info", description="Show details for a match")
    async def match_info(
        self,
        interaction: Interaction,
        stage: str = SlashOption(
            description="stage1 or stage2",
            choices={"Stage 1": "stage1", "Stage 2": "stage2"},
            required=True,
        ),
        match_id: str = SlashOption(description="Match ID (e.g. ub_r1_m1)", required=True),
    ):
        await interaction.response.defer(ephemeral=True)
        try:
            tournament = await api_client.get_tournament()
            match = tournament.get(stage, {}).get("matches", {}).get(match_id)
            if not match:
                return await interaction.followup.send(
                    embed=embeds.error_embed(f'Match `{match_id}` not found.'), ephemeral=True
                )
            await interaction.followup.send(embed=embeds.match_embed(match, stage), ephemeral=True)
        except Exception as e:
            await interaction.followup.send(embed=embeds.error_embed(str(e)), ephemeral=True)


def setup(bot, admin_role_ids):
    bot.add_cog(MatchesCog(bot, admin_role_ids))
