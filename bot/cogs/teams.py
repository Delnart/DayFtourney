"""Teams cog — /team add, /team list, /team remove"""

import nextcord
from nextcord.ext import commands
from nextcord import Interaction, SlashOption
import nextcord.ui as ui

from utils import api_client, embeds


class AddTeamModal(ui.Modal):
    def __init__(self):
        super().__init__("➕ Add Team", timeout=300)

        self.name_input = ui.TextInput(
            label="Team Name",
            placeholder="e.g. NAVI",
            min_length=1,
            max_length=64,
            required=True,
        )
        self.logo_input = ui.TextInput(
            label="Logo URL (optional)",
            placeholder="https://...",
            required=False,
        )
        self.day_input = ui.TextInput(
            label="Qualifier Day (optional)",
            placeholder="25.04",
            required=False,
            max_length=32,
        )
        self.add_item(self.name_input)
        self.add_item(self.logo_input)
        self.add_item(self.day_input)

    async def callback(self, interaction: Interaction):
        name = self.name_input.value.strip()
        logo = self.logo_input.value.strip() or None
        day = self.day_input.value.strip() or None

        try:
            result = await api_client.add_team(name, logo, day)
            team = result["team"]
            await interaction.response.send_message(
                embed=embeds.success_embed(
                    f"Team **{team['name']}** added!\n"
                    f"ID: `{team['id']}`"
                    + (f"\nDay: {team['day']}" if team.get("day") else "")
                ),
                ephemeral=True,
            )
        except Exception as e:
            await interaction.response.send_message(
                embed=embeds.error_embed(str(e)), ephemeral=True
            )


class TeamsCog(commands.Cog):
    def __init__(self, bot: commands.Bot, admin_role_ids: list[int]):
        self.bot = bot
        self.admin_role_ids = admin_role_ids

    def is_admin(self, member: nextcord.Member) -> bool:
        if not self.admin_role_ids:
            return True  # No roles configured → allow all
        return any(r.id in self.admin_role_ids for r in member.roles)

    @nextcord.slash_command(name="team", description="Manage tournament teams")
    async def team(self, interaction: Interaction):
        pass

    @team.subcommand(name="add", description="Register a new team")
    async def team_add(self, interaction: Interaction):
        if not self.is_admin(interaction.user):
            return await interaction.response.send_message(
                embed=embeds.error_embed("You don't have permission to add teams."),
                ephemeral=True,
            )
        await interaction.response.send_modal(AddTeamModal())

    @team.subcommand(name="list", description="Show all registered teams")
    async def team_list(self, interaction: Interaction):
        await interaction.response.defer(ephemeral=True)
        try:
            teams = await api_client.get_teams()
            await interaction.followup.send(embed=embeds.team_list_embed(teams), ephemeral=True)
        except Exception as e:
            await interaction.followup.send(embed=embeds.error_embed(str(e)), ephemeral=True)

    @team.subcommand(name="remove", description="Remove a team by ID")
    async def team_remove(
        self,
        interaction: Interaction,
        team_id: str = SlashOption(name="team_id", description="Team ID (from /team list)", required=True),
    ):
        if not self.is_admin(interaction.user):
            return await interaction.response.send_message(
                embed=embeds.error_embed("You don't have permission to remove teams."),
                ephemeral=True,
            )
        await interaction.response.defer(ephemeral=True)
        try:
            result = await api_client.delete_team(team_id)
            await interaction.followup.send(
                embed=embeds.success_embed(f"Team **{result['deleted']['name']}** removed."),
                ephemeral=True,
            )
        except Exception as e:
            await interaction.followup.send(embed=embeds.error_embed(str(e)), ephemeral=True)


def setup(bot, admin_role_ids):
    bot.add_cog(TeamsCog(bot, admin_role_ids))
