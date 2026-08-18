# CypherGuide: An Epic in 60 Episodes (English thread version for Nostr/Amethyst)

Each episode below is a short note meant to be posted in sequence — either as a
reply thread (reply to the previous note) or spread over several days to gauge
community reaction, whichever you prefer. Copy each block, post in order.

---

**Episode 1/60**
Once, every rental door on the internet had to pass through a gatekeeper.
That gatekeeper held the key to your identity — and could take it away with
a single line of a terms-of-service update, changed at midnight.

#CypherGuide #Nostr

---

**Episode 2/60**
CypherGuide wasn't built to "compete" with that gatekeeper.
It came from a much simpler question: if identity is mine, and reputation is
mine — what, exactly, is the middleman for?

#CypherGuide #Nostr #Decentralization

---

**Episode 3/60**
There's no central server holding the ledger here.
The ledger is Nostr — thousands of scattered relays, owned by no one,
permissioned by no one.

#Nostr #Relay

---

**Episode 4/60**
Money doesn't flow through a payment gateway that keeps a cut and your data.
It flows through Lightning and Cashu — currency that carries no one's name.

#Lightning #Cashu #Bitcoin

---

**Episode 5/60**
In places telecom signal never reaches — deep in the mountains, in the
middle of a ten-day silent retreat with no wifi — there's still LoRa mesh.
Small radios passing packets hand to hand, patiently, answering to nothing
but the laws of physics.

#LoRa #Mesh #OffGrid

---

**Episode 6/60**
This is the epic of building that place — not from one perfect plan written
on day one, but from eleven real arguments (RFCs), still unfinished, the way
anything worth building together always is. 60 episodes follow. Read slow.

#CypherGuide #RFC #BuildInPublic

---

**Episode 7/60**
Before there were rooms to book, one root question had to be answered: if
you stay tonight in a thatched hut in the highlands, and tomorrow want to
join a coding course elsewhere — does the reputation you built at that
guesthouse follow you?

#CypherGuide #RFC0003

---

**Episode 8/60**
If every app invents its own metric, you end up locked into each app
individually — the exact old world Nostr was built to break.

#Nostr #Identity

---

**Episode 9/60**
The first principle, frozen earliest: identity is your npub, not an account
issued by anyone.

#RFC0003 #Npub

---

**Episode 10/60**
Reputation can travel with a person — it cannot be bought, sold, or
transferred. This isn't a score in a game. It's your real history.

#PortableReputation #RFC0003

---

**Episode 11/60**
Every future app — Learn, Build, Connect — will read from this same
identity layer, interpret it their own way, but none gets to overwrite the
original definition.

#CypherGuide #Ecosystem

---

**Episode 12/60**
This is the foundation. Every chapter that follows stands on it.

#RFC0003 #Foundation

---

**Episode 13/60**
A community with no bank still needs somewhere to hold shared funds when a
dispute happens. But who holds the key to that fund?

#CypherGuide #RFC0001

---

**Episode 14/60**
Not one founder sitting there forever. Not a committee appointed by someone.

#Decentralization #Governance

---

**Episode 15/60**
The Guardian Council — the group holding the insurance fund — is chosen from
the npubs with the highest real reputation, measured by nights actually
stayed, not empty promises. Seven people, two-thirds consensus.

#RFC0001 #GuardianCouncil

---

**Episode 16/60**
Every Cashu contribution is locked to that council right at mint time — no
one can withdraw alone, no one outside the group can force their way in.

#Cashu #NUT11 #RFC0001

---

**Episode 17/60**
And the platform fee — the thing anyone who's booked elsewhere has learned
to dread — doesn't sit at one flat rate for everyone. It curves downward
with accumulated reputation.

#RFC0002 #Fees

---

**Episode 18/60**
Steepest at the very first steps — so a newcomer just joining the community
feels the reward of trust being built immediately — then flattening out as
reputation grows, so no one accumulates infinite privilege just for arriving
early.

#RFC0002 #ReputationCurve

---

**Episode 19/60**
Both numbers — seven people, a logarithmic curve — are openly admitted as
imperfect. Just a starting point for the community to keep arguing over, not
carved-in-stone truth. Do you think seven is enough?

#RFC0001 #RFC0002 #OpenToDebate

---

**Episode 20/60**
A decentralized community still needs to speak one shared language so no one
gets left behind.

#RFC0004 #i18n

---

**Episode 21/60**
Every hardcoded string in the interface was pulled out and placed into a
living dictionary — nothing locked to one language.

#i18n #CypherGuide

---

**Episode 22/60**
Vietnamese and English stand as equals. Neither is the "default" with the
other as a second-class translation. Whatever language the community brings
next will stand just as equal.

#RFC0004 #Multilingual

---

**Episode 23/60**
When the community needs an assistant to answer questions about the protocol
itself, it can't be allowed to become a mouth that says whatever it wants.

#RFC0005 #DocsAssistant

---

**Episode 24/60**
That assistant is only allowed to say what's actually written in the RFCs,
in the architecture docs — nothing more, nothing invented just to sound
good.

#GroundedAI #RFC0005

---

**Episode 25/60**
This is one of the few places the project accepts a deliberate exception to
its "no backend" principle: one small server, whose only job is hiding an
API key — holding nothing else of yours.

#RFC0005 #HonestTradeoffs

---

**Episode 26/60**
Some places in the world require knowing exactly who you are before letting
you in — because the law there demands it, not because the protocol wants
it.

#RFC0006 #KYC

---

**Episode 27/60**
CypherGuide doesn't pretend that problem doesn't exist, and doesn't force
every door to be identical either.

#RFC0006 #ApplicationNeutrality

---

**Episode 28/60**
A verification layer exists — but only when someone chooses to pull it out.
A Nostr event, self-signed after a third-party verifier confirms it,
attesting "verified" without exposing your real documents to anyone.

#RFC0006 #Attestation

---

**Episode 29/60**
Whichever app needs it, uses it. Whichever app doesn't, treats that layer as
if it never existed. No one is forced to live under the same rule.

#RFC0006 #OptIn

---

**Episode 30/60**
Then came a bigger question than the platform itself: what if even AI
answering questions didn't need a central server either?

#RFC0007 #DecentralizedAI

---

**Episode 31/60**
Three layers imagined: small radios at the mountain's foot quietly relaying
data outward; a search layer running right on your own device; and a final
layer where you plug in your own key — no one standing between you and the
intelligence you choose to trust.

#RFC0007 #LoRa #Mesh

---

**Episode 32/60**
No middleman between you and the intelligence you choose to trust.

#RFC0007 #NoMiddleman

---

**Episode 33/60**
One idea got shelved partway through: "why not let those small radios think
for themselves?"

#RFC0007 #EdgeAI

---

**Episode 34/60**
The honest answer, no dodging it: not yet. Physics doesn't allow it. A chip
the size of a matchbox can't hold enough for real intelligence.

#RFC0009 #HardwareLimits

---

**Episode 35/60**
But the dream didn't die — it just moved to a more capable device sitting
right at the network's edge.

#RFC0009 #EdgeComputing

---

**Episode 36/60**
A Raspberry Pi sitting quietly in the corner of a meditation hall, computing
locally, waiting for no one's permission.

#RFC0009 #RaspberryPi

---

**Episode 37/60**
Never calling out. That's the full meaning of "decentralized" when carried
all the way to its logical end.

#RFC0009 #Privacy

---

**Episode 38/60**
Not every door should carry a listed price.

#RFC0008 #Dana

---

**Episode 39/60**
At a meditation retreat, a hut in the middle of the forest, putting a fixed
number on stillness is wrong from the very root.

#RFC0008 #MeditationRetreat

---

**Episode 40/60**
So a different kind of listing exists: no escrow, no invoice locked in
advance.

#RFC0008 #NoEscrow

---

**Episode 41/60**
Just a "dana" button appearing after you've already left — not before.

#RFC0008 #Dana

---

**Episode 42/60**
So gratitude never gets mistaken for a ticket price.

#RFC0008 #NonTransactional

---

**Episode 43/60**
Then came an idea that didn't come from any line of code — it came from an
image.

#RFC0010 #Zen

---

**Episode 44/60**
A hand-drawn circle, its brushstroke left unclosed, representing zero.

#RFC0010 #Enso

---

**Episode 45/60**
A single incense stick, lit, representing one.

#RFC0010 #Incense

---

**Episode 46/60**
And three hundred sixty-nine seconds of silence in between, where you try to
think of nothing.

#RFC0010 #369Seconds #Stillness

---

**Episode 47/60**
The hardest question wasn't "how do we animate this" — it was: should a
ritual built for letting go generate any proof at all?

#RFC0010 #DesignPhilosophy

---

**Episode 48/60**
The answer chosen was no. No badge. No reputation score.

#RFC0010 #NoProof

---

**Episode 49/60**
No one — not even the protocol itself — knows whether you were truly still,
or whether your mind wandered for all 369 seconds. Turning it into something
to "achieve" would betray the entire reason it exists.

#RFC0010 #NonAttachment

---

**Episode 50/60**
When the second Keisu bell rings — two strikes, a few seconds apart — the
screen quietly closes. No "Complete!" message. The incense has burned out.
That's all.

#RFC0010 #Keisu #Bell

---

**Episode 51/60**
Looking back at all of it, two hands are building the same house in two
different directions.

#RFC0011 #DesignTension

---

**Episode 52/60**
One turns good behavior into a number — lower fees, more authority — because
the community needs a fair way to choose who holds the shared fund.

#RFC0011 #Financialization

---

**Episode 53/60**
The other flatly refuses to measure anything — because some things, once
priced, lose the very meaning that made them worth doing.

#RFC0011 #AntiFinancialization

---

**Episode 54/60**
Neither hand is wrong. What was missing was just one shared question.

#RFC0011 #Principle

---

**Episode 55/60**
The first test: can this actually be verified, or is it just your own
unwitnessed word for it?

#RFC0011 #Verifiability

---

**Episode 56/60**
The second test: does measuring this serve the protocol's integrity, or is
it just a badge for fun?

#RFC0011 #ProtocolPurpose

---

**Episode 57/60**
The third test: does this behavior's own tradition define it as
non-transactional in the first place?

#RFC0011 #OriginalMeaning

---

**Episode 58/60**
Running five existing decisions back through those three questions — none of
them were wrong. They just hadn't been put into words until now.

#RFC0011 #CypherGuide

---

**Episode 59/60**
This isn't a finished product looking for users. This is eleven real
arguments, some of them still ending in open questions, waiting for someone
in the community to step in and say "I see it differently." There's no
company standing behind this door for you to trust.

#CypherGuide #OpenRFC #JoinUs

---

**Episode 60/60 — End**
The circle is still unclosed. That's not a flaw to fix.
That's the space left for you to pick up the brush next. 🕯️

#CypherGuide #Nostr #Cashu #Lightning #LoRa #Zen #Enso
