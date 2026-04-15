import os
import aiohttp
from dotenv import load_dotenv

load_dotenv()

API_URL = os.getenv("API_URL", "http://localhost:3001")
API_SECRET = os.getenv("API_SECRET", "")


def _headers() -> dict:
    return {"x-api-key": API_SECRET, "Content-Type": "application/json"}


async def get_tournament() -> dict:
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{API_URL}/api/tournament") as r:
            r.raise_for_status()
            return await r.json()


async def get_teams() -> list:
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{API_URL}/api/teams") as r:
            r.raise_for_status()
            return await r.json()


async def add_team(name: str, logo_url: str | None, day: str | None) -> dict:
    payload = {"name": name, "logoUrl": logo_url, "day": day}
    async with aiohttp.ClientSession() as session:
        async with session.post(f"{API_URL}/api/teams", json=payload, headers=_headers()) as r:
            r.raise_for_status()
            return await r.json()


async def delete_team(team_id: str) -> dict:
    async with aiohttp.ClientSession() as session:
        async with session.delete(f"{API_URL}/api/teams/{team_id}", headers=_headers()) as r:
            r.raise_for_status()
            return await r.json()


async def submit_match_result(
    stage: str, match_id: str, winner_id: str,
    score1: int | None, score2: int | None
) -> dict:
    payload = {
        "stage": stage,
        "matchId": match_id,
        "winnerId": winner_id,
        "score1": score1,
        "score2": score2,
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(f"{API_URL}/api/matches/result", json=payload, headers=_headers()) as r:
            r.raise_for_status()
            return await r.json()


async def schedule_match(
    stage: str, match_id: str,
    scheduled_date: str | None = None,
    bo: int | None = None,
    stream_url: str | None = None
) -> dict:
    payload = {"stage": stage, "matchId": match_id}
    if scheduled_date:
        payload["scheduledDate"] = scheduled_date
    if bo:
        payload["bo"] = bo
    if stream_url is not None:
        payload["streamUrl"] = stream_url
    async with aiohttp.ClientSession() as session:
        async with session.patch(f"{API_URL}/api/matches/schedule", json=payload, headers=_headers()) as r:
            r.raise_for_status()
            return await r.json()


async def generate_bracket(stage: str) -> dict:
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{API_URL}/api/tournament/generate/{stage}",
            headers=_headers()
        ) as r:
            r.raise_for_status()
            return await r.json()


async def reset_tournament() -> dict:
    async with aiohttp.ClientSession() as session:
        async with session.post(f"{API_URL}/api/tournament/reset", headers=_headers()) as r:
            r.raise_for_status()
            return await r.json()


async def update_config(data: dict) -> dict:
    async with aiohttp.ClientSession() as session:
        async with session.patch(
            f"{API_URL}/api/tournament/config",
            json=data,
            headers=_headers()
        ) as r:
            r.raise_for_status()
            return await r.json()

async def generate_admin_link() -> dict:
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{API_URL}/api/auth/generate",
            headers=_headers()
        ) as r:
            r.raise_for_status()
            return await r.json()
