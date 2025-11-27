# Jolly “Žolíky” Game Rules

## 1. Game Components
*   **Deck:** 2 × Standard Decks (52 cards) + 4 Jokers = **108 Cards** total.
*   **Players:** Human vs CPU.
*   **Dealing:** 
    *   **Human:** Dealt **13 cards** initially.
    *   **CPU:** Dealt **12 cards**.
    *   *Joker Hunt:* At the start, the player checks the bottom 3 cards of the deck. Any Jokers found are added to the player's hand.
    *   *Jolly Card:* The card at the very bottom of the deck is left face up (partially visible) under the stock.

## 2. Card Values
*   **Number Cards (2-9):** Face value (e.g., 5 = 5 points).
*   **Face Cards (10, J, Q, K):** 10 points.
*   **Ace:**
    *   **1 point** when used in a low run (A-2-3).
    *   **10 points** when used in a high run (Q-K-A) or a Set (A-A-A).
*   **Joker:**
    *   Assumes the point value of the card it represents.
    *   Example: In a run `4-5-JK`, Joker is 6 points. In `A-A-JK`, Joker is 10 points.

## 3. Game Structure
The game progresses in **Rounds**.

### Phase 1: The Setup (Rounds 1 & 2)
*   **Restriction:** **NO Melding** is allowed during the first two rounds.
*   **Turn Sequence:**
    1.  **Draw:** You must draw from the **Stock Pile**. (Drawing from Discard is locked).
    2.  **Discard:** You must discard one card to end your turn.

### Phase 2: The Game (Round 3+)
*   **Melding Enabled:** Players can now place melds on the table if they meet the opening requirements.
*   **Turn Sequence:**
    1.  **Draw:**
        *   **Stock:** Draw the top card (hidden).
        *   **Discard Pile:** Draw the top visible card.
        *   *Constraint:* If you draw from the Discard Pile, you **MUST** use that card in a meld immediately. You cannot simply add it to your hand for later.
    2.  **Action (Meld/Swap):**
        *   Place valid melds (Sets/Runs) on the table.
        *   Add cards to existing melds (only if you have already Opened).
        *   Swap a card for a Joker on the table.
    3.  **Discard:**
        *   Discard one card to end the turn.

## 4. Melding Rules

### Opening Requirement
To place your *first* melds of the game, you must satisfy **both** conditions simultaneously:
1.  **Minimum Points:** The total value of cards being melded must be **36 points** or more.
2.  **Pure Run:** You must play at least one **Run** that contains **NO Jokers** (e.g., `5♥, 6♥, 7♥`).

### Valid Melds
*   **Run:** 3 or more consecutive cards of the **same suit** (e.g., `9♣, 10♣, J♣`).
    *   *Ace:* Can be low (`A-2-3`) or high (`Q-K-A`). Cannot wrap around (`K-A-2` is Invalid).
*   **Set:** 3 or 4 cards of the **same rank** but **different suits**.
    *   Valid: `7♥, 7♣, 7♦`
    *   Invalid: `7♥, 7♥, 7♣` (Duplicate suit).

### Joker Rules
*   **Wildcard:** A Joker can substitute any card.
*   **Adjacency:** Two Jokers cannot be adjacent in a meld (e.g., `4, JK, JK, 7` is invalid).
*   **Swapping:**
    *   If a Joker is on the table representing a specific card (e.g., `4♥` in a run), and you hold the real `4♥`, you can swap.
    *   *Condition:* You must have **Opened** before swapping.
    *   *Set Constraint:* You can only swap a Joker from a Set if the resulting Set contains **all 4 suits**. You cannot take a Joker from a Set of 3 if it leaves only 3 cards/suits remaining.
    *   *Usage:* A swapped Joker must be used in a new meld immediately. It cannot be hoarded.

## 5. Special Mechanics

### The Jolly Hand
*   **Trigger:** Available only at the **start of your turn** in **Round 3+**.
*   **Conditions:**
    1.  You have not Opened yet.
    2.  You have exactly **12 cards** in hand.
    3.  The bottom card of the deck (Jolly Card) is available.
*   **The Gamble:** You pick up the Jolly Card (hand becomes 13).
*   **Victory Requirement:** You must immediately meld **ALL 13 cards** (leaving 0 or 1 to discard) to win the game instantly. If you cannot meld everything, you lose the game/turn.

### Winning
*   The game ends when a player melds their cards and discards their final card.
*   **Constraint:** You cannot discard your last card if you haven't met the Opening Requirements (unless executing a Jolly Hand victory).
