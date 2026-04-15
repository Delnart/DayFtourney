"""Day F Tournament Discord Bot — main entry point

Runs the Discord bot AND a lightweight aiohttp web server on PORT
so Render treats this as a Web Service (required for free tier).
Use UptimeRobot to ping /health every 5 minutes to prevent sleep.
"""

import os
import sys
import asyncio
import logging

import nextcord
from nextcord.ext import commands
from aiohttp import web
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
PORT = int(os.getenv("PORT", 8080))  # Render sets PORT automatically

if not BOT_TOKEN:
    logger.error("BOT_TOKEN is not set. Copy bot/.env.example to bot/.env and fill it in.")
    sys.exit(1)
if not GUILD_ID:
    logger.error("GUILD_ID is not set.")
    sys.exit(1)

GUILD_ID = int(GUILD_ID)

# --- Admin role IDs ---
ADMIN_ROLE_IDS: list[int] = []

# --- Bot setup ---
intents = nextcord.Intents.default()
bot = commands.Bot(intents=intents, default_guild_ids=[GUILD_ID])


# ──────────────────────────────────────────────
# Health check web server (keeps Render awake)
# ──────────────────────────────────────────────

async def handle_health(request: web.Request) -> web.Response:
    return web.json_response({"status": "ok", "bot": str(bot.user)})

async def start_webserver():
    app = web.Application()
    app.router.add_get("/", handle_health)
    app.router.add_get("/health", handle_health)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", PORT)
    await site.start()
    logger.info(f"Health server running on port {PORT}")


# ──────────────────────────────────────────────
# Bot events
# ──────────────────────────────────────────────

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

    # Load cogs
    from cogs import teams, matches, tournament, admin
    teams.setup(bot, ADMIN_ROLE_IDS)
    matches.setup(bot, ADMIN_ROLE_IDS)
    tournament.setup(bot, ADMIN_ROLE_IDS)
    admin.setup(bot, ADMIN_ROLE_IDS)

    # Sync slash commands to guild
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


# ──────────────────────────────────────────────
# Entry point — run bot + web server together
# ──────────────────────────────────────────────

async def main():
    await start_webserver()
    await bot.start(BOT_TOKEN)

if __name__ == "__main__":
    logger.info("Starting bot + health server...")
    asyncio.run(main())
