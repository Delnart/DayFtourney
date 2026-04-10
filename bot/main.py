"""Day F Tournament Discord Bot — main entry point"""

import os
import sys
import logging

import nextcord
from nextcord.ext import commands
from dotenv import load_dotenv

load_dotenv()

# --- Logging ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("bot")

# --- Validate required env vars ---
BOT_TOKEN = os.getenv("BOT_TOKEN")
GUILD_ID = os.getenv("GUILD_ID")

if not BOT_TOKEN:
    logger.error("BOT_TOKEN is not set. Copy bot/.env.example to bot/.env and fill it in.")
    sys.exit(1)
if not GUILD_ID:
    logger.error("GUILD_ID is not set.")
    sys.exit(1)

GUILD_ID = int(GUILD_ID)

# --- Admin role IDs (stored in API config, loaded on startup) ---
ADMIN_ROLE_IDS: list[int] = []

# --- Bot setup ---
intents = nextcord.Intents.default()
bot = commands.Bot(intents=intents)


@bot.event
async def on_ready():
    logger.info(f"Logged in as {bot.user} (ID: {bot.user.id})")
    logger.info(f"Registered to guild: {GUILD_ID}")

    # Try to load admin role IDs from API
    try:
        from utils import api_client
        data = await api_client.get_tournament()
        role_ids = data.get("config", {}).get("adminRoleIds", [])
        global ADMIN_ROLE_IDS
        ADMIN_ROLE_IDS = [int(r) for r in role_ids if str(r).isdigit()]
        if ADMIN_ROLE_IDS:
            logger.info(f"Loaded {len(ADMIN_ROLE_IDS)} admin role(s) from API")
        else:
            logger.warning("No admin roles configured — all users can use admin commands!")
    except Exception as e:
        logger.warning(f"Could not load admin roles from API: {e}. Allowing all users.")

    # Load cogs (pass admin roles so they can do permission checks)
    from cogs import teams, matches, tournament
    teams.setup(bot, ADMIN_ROLE_IDS)
    matches.setup(bot, ADMIN_ROLE_IDS)
    tournament.setup(bot, ADMIN_ROLE_IDS)

    # Sync slash commands to the guild
    await bot.sync_application_commands(guild_id=GUILD_ID)
    logger.info("Slash commands synced!")


@bot.event
async def on_application_command_error(interaction: nextcord.Interaction, error: Exception):
    logger.error(f"Command error: {error}", exc_info=error)
    msg = "An unexpected error occurred. Please try again."
    if interaction.response.is_done():
        await interaction.followup.send(msg, ephemeral=True)
    else:
        await interaction.response.send_message(msg, ephemeral=True)


if __name__ == "__main__":
    logger.info("Starting bot...")
    bot.run(BOT_TOKEN)
