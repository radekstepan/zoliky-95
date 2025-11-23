# Jolly “Žolíky” Card Game Rules Specification

## 1. Components
*   **Deck:** 2 × French Decks (52 cards each) + 4 Jokers = 108 Cards total.
*   **Card Values:**
    *   **2 - 9:** Face value (e.g., 4 = 4 points).
    *   **10, J, Q, K:** 10 points.
    *   **Ace:**
        *   **1 point** if used in a low run (A-2-3).
        *   **10 points** if used in a high run (Q-K-A) or in a Set (A-A-A).
    *   **Joker:**
        *   Assume the point value of the card it represents (e.g., in a run 4-5-JK, Joker counts as 6 points).
        *   *Note:* If used in a set of face cards or Aces, it counts as 10.

## 2. Game Setup
*   **Shuffle:** Dealer shuffles the deck.
*   **The Cut & Joker Hunt:**
    *   The player to the right of the dealer splits the deck.
    *   They look at the **bottom 3 cards** of the deck.
    *   Any **Jokers** found among these 3 are kept by that player (added to their hand).
    *   The first **non-Joker** card found from the bottom is turned face up and placed **underneath** the deck (visible). This is the "Jolly Hand" target card.
*   **Dealing:**
    *   **Player to Left of Dealer:** Dealt **13 cards** (3 initially, then 2 at a time).
    *   **Other Players:** Dealt **12 cards** (2 at a time).
    *   *Adjustment:* If the cutter kept Jokers, their dealt count is adjusted so they end up with the standard hand size + the extra Jokers? (Standard rule implies they just start with a stronger hand, effectively receiving the Joker "instead" of a random draw, or in addition. *Implementation Standard: Cutter keeps Joker, dealt cards ensure final hand count is 12 (or 13 if leading).* )

## 3. Gameplay Loop
*   **Start:** The player with 13 cards begins by discarding 1 card face up to start the discard pile.
*   **Turn Phases:**
    1.  **Draw:**
        *   Draw top card from **Stock** (Deck).
        *   **OR** Draw top card from **Discard Pile**.
        *   *Restriction:* Drawing from Discard Pile is allowed **only** if the card is **immediately** used in a meld on the table. (Consequently, this is not allowed until Round 3).
    2.  **Meld (Action Phase):**
        *   Players must wait until **Round 3** to place melds.
        *   Form new melds or add to existing melds (once opened).
    3.  **Discard:**
        *   Discard one card face up to end the turn.
        *   *Victory Condition:* If this is the last card and hand is empty, the player wins. Ideally discarded face down "dramatically".

## 4. Melding Rules
*   **Opening Requirement:**
    *   To place the first melds, a player must put down cards totaling at least **36 Points**.
    *   This opening play must include at least **1 Pure Run** (Straight Flush sequence containing **NO Jokers**).
*   **Valid Melds:**
    *   **Sets:** 3 or 4 cards of the same rank but **different suits** (e.g., 7♦, 7♥, 7♣).
    *   **Runs:** Sequence of ascending cards in the **same suit** (e.g., 9♣, 10♣, J♣).
*   **Invalid Melds:**
    *   "Around the corner" runs (e.g., K-A-2) are **not** allowed.
*   **Joker Constraints:**
    *   Can replace any card.
    *   **Two Jokers cannot be adjacent** to each other in a meld.

## 5. Joker Interaction
*   **Swapping:**
    *   If a Joker on the table represents a specific card, and a player holds that actual card, they may swap their card for the Joker.
    *   **Constraint (Runs):** Direct swap allowed.
    *   **Constraint (Sets):** A Joker can only be taken from a Set if the resulting Set on the table contains **all 4 unique suits** (Hearts, Diamonds, Clubs, Spades). You cannot take a Joker from a Set of 3 if it leaves only 3 suits on the table.
*   **Usage:** A Joker taken from the table must be used in a meld **immediately** (in the same turn). It cannot be hoarded in hand.

## 6. The "Jolly Hand"
*   **Trigger:** A player has exactly **12 cards** in hand (start of turn).
*   **Action:** The player may draw the **visible bottom card** (the one revealed at setup).
*   **Condition:** The player must **meld their entire hand** using that card and win the game in that specific turn.
*   **Failure:** You cannot pick up the Jolly Card if you cannot go out immediately.

## 7. Deck Depletion
*   If the Stock runs out, the Discard Pile is **reshuffled** to form a new Stock.

## 8. Scoring & End Game
*   **Winner:** The player who melds all cards and discards their last card.
*   **Losers:**
    *   Receive **-1 game point** for every card remaining in their hand.
    *   (Jokers in hand count as standard cards for penalty purposes, typically -1).
