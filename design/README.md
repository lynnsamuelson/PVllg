# Design: screen map

`PVill-all-screens.pdf` has the 25 mockups. Colors, tokens, components and contrast rules are in the Design section of
`AGENTS.md`; this file only maps each screen to the Jira tickets that build it, plus the rules each screen must keep.

The "Ticket N" chips printed under each screen in the PDF use an older numbering. **Use the KAN keys below.**

| # | Screen | Built in | Must keep |
| --- | --- | --- | --- |
| 1 | Welcome | KAN-5 | One green Get started button; Sign in is an outline button. Demo note. |
| 2 | Choose an account type | KAN-5 | Two cards, one pick; selected card has green outline + sage tint. |
| 3 | Profile: area and journey | KAN-6 | ZIP only, never a street address. Arrival month only for Expecting/Both. |
| 4 | Profile: children and roles | KAN-6 | Age-group chips, no names or birth dates. Prefer not to say clears other roles. |
| 5 | Profile: needs | KAN-6 | The four categories used everywhere: Diapers & everyday essentials, Food & feeding, Parenting & newborn, Housing & family stability. |
| 6 | Profile: how to use PVill | KAN-6, KAN-24 | Get / Give / Both cards. Privacy note about exact location. |
| 7 | Organization sign-up | KAN-7 | Email must match website domain; free email rejected. |
| 8 | Enter the code | KAN-7 | Six code boxes. Pending badge until confirmed, then Verified. |
| 9 | Organization profile | KAN-8 | Verified badge at top. Public address is an organization's, never a person's. |
| 10 | Impact numbers | KAN-23 | Six tiles. "Example data" badge on made-up numbers; savings labeled estimates. |
| 11 | Home | KAN-25 | Built from the person's own answers. "Welcome" with no name if none is known. |
| 12 | Search near me | KAN-15, KAN-16 | Items/Resources tabs; chips All, Essentials, Feeding, Parenting, **Housing** (missing from the mockup). Rounded distances only. |
| 13 | Item details: organization | KAN-17, KAN-12 | Public address shown. "Claim one (held for 3 days)". |
| 14 | Item details: person | KAN-17, KAN-11, KAN-12 | No street address, exact distance or full name. Private note. "Request to claim". |
| 15 | My claims | KAN-12, KAN-11, KAN-13, KAN-14, KAN-19, KAN-20 | Approved card shows place; Waiting card hides it. Active/Past tabs. |
| 16 | Add to calendar | KAN-19 | Both reminders checked by default. No exact address for a person's item before approval. |
| 17 | Report a pickup problem | KAN-20 | Fixed reasons, no chat. 200-character note. "In an emergency, call 911." |
| 18 | After a pickup report | KAN-20 | Giver sees only the reason, never the family's name or note. |
| 19 | Post an item: about the item | KAN-9 | Both condition checkboxes required. No breastmilk, medicine or health-sensitive items. |
| 20 | Post an item: pickup details | KAN-9, KAN-11 | General area public; exact address private until approval. Org address prefilled. |
| 21 | My items and claim requests | KAN-10, KAN-13, KAN-14, KAN-20 | First name only. Counts never below zero. |
| 22 | Resource details | KAN-18, KAN-21 | "May be a good fit", never "you qualify". Source and last-checked date always shown. |
| 23 | Reach out: demo preview | KAN-21 | Bottom sheet, "Demo only". Never says "Request sent". |
| 24 | Report a problem | KAN-22 | Bottom sheet over the item page. |
| 25 | Edit profile and switch roles | KAN-24 | At least one of Get/Give stays on. Bottom bar matches the switches. |

## Not in the PDF yet

Being designed in KAN-4. Until then, build them from the shared components so they match:

- Sign in screen
- Wrong or old code message (8)
- Search loading, no results and could-not-load states (12)
- My claims empty state and Past tab (15); My items empty state (21)
- Claim failed because someone else got the last item (13, 14)
- Paused item with "Yes, it is available" (21); "Pickup details changed" notice (15)
- Saved and could-not-save messages (25)
