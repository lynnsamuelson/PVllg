"""The calendar file for a claim (KAN-19): an iCalendar (.ics) event that common calendar apps open. Its place
follows the privacy rule (KAN-11): a person's exact address only once the claim is Approved."""
from datetime import datetime, timezone

from items import privacy
from items.models import LOCAL_TZ

REMINDERS = {"day": "-P1D", "hour": "-PT1H"}  # 1 day before, 1 hour before (Mock Up 16)


def escape(text):
    """iCalendar text: backslash, semicolon, comma and newline are escaped; Windows line breaks become newlines."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    return text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def fold(line):
    """iCalendar lines are at most 75 octets; longer ones continue on the next line after a space."""
    out, data = [], line.encode()
    while len(data) > 75:
        cut = 75
        while data[cut] & 0xC0 == 0x80:  # don't split a UTF-8 character
            cut -= 1
        out.append(data[:cut].decode())
        data = b" " + data[cut:]
    out.append(data.decode())
    return "\r\n".join(out)


def stamp(moment):
    return moment.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def event_details(claim, user):
    """(where, notes) for the event, with the privacy rule applied: Where to go only with the exact place."""
    item = claim.item
    visible = privacy.can_see_exact_address(user, item)
    where = item.exact_address if visible else item.general_area
    notes = [part for part in (item.where_to_go if visible else "", item.what_to_bring, item.details) if part]
    return where, " ".join(notes)


def ics(claim, user, reminders, now):
    """The .ics text for `claim` as `user` may see it, with an alarm for each key of REMINDERS in `reminders`."""
    item = claim.item
    where, notes = event_details(claim, user)
    start = datetime.combine(item.pickup_date, item.pickup_start, tzinfo=LOCAL_TZ)
    end = datetime.combine(item.pickup_date, item.pickup_end, tzinfo=LOCAL_TZ)
    summary = escape(f"Pick up: {item.name}")
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//PVill//Pickups//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:claim-{claim.pk}@pvill",
        # Grows when the giver changes when or where, so calendar apps replace the event the family added before.
        f"SEQUENCE:{int(item.pickup_changed_at.timestamp()) if item.pickup_changed_at else 0}",
        f"DTSTAMP:{stamp(now)}",
        f"DTSTART:{stamp(start)}",
        f"DTEND:{stamp(end)}",
        f"SUMMARY:{summary}",
        f"LOCATION:{escape(where)}",
        f"DESCRIPTION:{escape(notes)}",
    ]
    for key in reminders:
        lines += ["BEGIN:VALARM", "ACTION:DISPLAY", f"DESCRIPTION:{summary}", f"TRIGGER:{REMINDERS[key]}", "END:VALARM"]
    lines += ["END:VEVENT", "END:VCALENDAR"]
    return "\r\n".join(fold(line) for line in lines) + "\r\n"
