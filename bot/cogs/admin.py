"""Admin Panel Access Cog"""

import nextcord
from nextcord.ext import commands
from nextcord import Interaction

from utils import api_client, embeds

class AdminCog(commands.Cog):
    def __init__(self, bot: commands.Bot, admin_role_ids: list[int]):
        self.bot = bot
        self.admin_role_ids = admin_role_ids

    def is_admin(self, member: nextcord.Member) -> bool:
        if not self.admin_role_ids:
            return True
        return any(r.id in self.admin_role_ids for r in member.roles)

    @nextcord.slash_command(name="admin", description="Get a secure one-time link to the web admin panel")
    async def admin_panel(self, interaction: Interaction):
        if not self.is_admin(interaction.user):
            return await interaction.response.send_message(
                embed=embeds.error_embed("You don't have permission to access the admin panel."),
                ephemeral=True,
            )
        
        await interaction.response.defer(ephemeral=True)
        try:
            res = await api_client.generate_admin_link()
            link = res.get("link")
            
            embed = nextcord.Embed(
                title="🔒 Admin Panel Access",
                description=f"Click the button below to access the web admin panel.\n\n"
                            f"**Security Note:** This is a one-time use link valid for 15 minutes. Do not share it.",
                color=0xEAB23A,
            )
            
            view = nextcord.ui.View()
            view.add_item(nextcord.ui.Button(label="Open Web Admin", url=link, style=nextcord.ButtonStyle.link))
            
            await interaction.followup.send(embed=embed, view=view, ephemeral=True)
        except Exception as e:
            await interaction.followup.send(embed=embeds.error_embed(f"Could not generate admin link: {e}"), ephemeral=True)

def setup(bot, admin_role_ids):
    bot.add_cog(AdminCog(bot, admin_role_ids))
