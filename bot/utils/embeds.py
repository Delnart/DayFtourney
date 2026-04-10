import nextcord


def match_embed(match: dict, stage: str) -> nextcord.Embed:
    t1 = match.get("team1", {}) or {}
    t2 = match.get("team2", {}) or {}
    t1_name = t1.get("name", "TBD")
    t2_name = t2.get("name", "TBD")
    bracket = match.get("bracket", "UB")
    state = match.get("state", "tbd")
    winner_id = match.get("winnerId")

    if state == "finished":
        winner_name = t1_name if winner_id == t1.get("id") else t2_name
        score1 = match.get("score1", "?")
        score2 = match.get("score2", "?")
        status_text = f"✅ **{winner_name}** won  `{score1}:{score2}`"
        loser_name = t2_name if winner_id == t1.get("id") else t1_name
        if match.get("nextLoseMatchId"):
            status_text += f"\n⬇️ *{loser_name} drops to LB*"
        color = 0x50C878
    elif state == "upcoming":
        status_text = "⏳ Not started"
        color = 0x8B5CF6 if bracket == "UB" else 0xE75A4D
    elif state == "bye":
        status_text = "🚫 BYE — auto advance"
        color = 0xEAB23A
    else:
        status_text = "📋 TBD"
        color = 0x888888

    embed = nextcord.Embed(
        title=f"[{bracket}] {match.get('roundName', 'Match')}",
        description=f"**{t1_name}** vs **{t2_name}**\n\n{status_text}",
        color=color,
    )
    embed.add_field(name="Match ID", value=f"`{match.get('id')}`", inline=True)
    embed.add_field(name="Stage", value=stage, inline=True)
    embed.add_field(name="Format", value=f"BO{match.get('bo', 1)}", inline=True)

    if match.get("scheduledDate"):
        embed.add_field(name="📅 Scheduled", value=match["scheduledDate"], inline=True)
    if match.get("nextWinMatchId"):
        embed.add_field(name="Winner →", value=f"`{match['nextWinMatchId']}`", inline=True)
    if match.get("nextLoseMatchId"):
        embed.add_field(name="Loser → LB", value=f"`{match['nextLoseMatchId']}`", inline=True)

    embed.set_footer(text="Day F 2026 Tournament")
    return embed


def team_list_embed(teams: list) -> nextcord.Embed:
    embed = nextcord.Embed(
        title=f"📋 Teams ({len(teams)})",
        color=0x8B5CF6,
    )
    if not teams:
        embed.description = "No teams registered yet."
        return embed

    lines = []
    for i, t in enumerate(teams, 1):
        day = f" · Day {t['day']}" if t.get("day") else ""
        lines.append(f"`{i}.` **{t['name']}** `{t['id']}`{day}")

    # Discord embed field limit is 1024 chars — split into chunks
    chunk = ""
    field_num = 1
    for line in lines:
        if len(chunk) + len(line) + 1 > 1020:
            embed.add_field(name=f"Teams ({field_num})", value=chunk, inline=False)
            chunk = ""
            field_num += 1
        chunk += line + "\n"
    if chunk:
        embed.add_field(name=f"Teams ({field_num})" if field_num > 1 else "Teams", value=chunk, inline=False)

    return embed


def error_embed(message: str) -> nextcord.Embed:
    return nextcord.Embed(title="❌ Error", description=message, color=0xE75A4D)


def success_embed(message: str) -> nextcord.Embed:
    return nextcord.Embed(title="✅ Success", description=message, color=0x50C878)
