# Žolíky 95 (Jolly Card Game)

A retro Windows 95-styled implementation of the card game "Jolly" (similar to Rummy), built with TypeScript and Vite.

## Features

- **Retro UI**: Authentic Windows 95 look and feel.
- **Drag & Drop / Animations**: Smooth card interactions.
- **Game Rules Engine**: Strict adherence to "Jolly" rules including Opening requirements, Ace values, and the "Jolly Hand" mechanic.
- **CPU Opponent**: Basic AI to play against.

## Installation & Running

1. **Install Dependencies**
   ```bash
   yarn install
   ```

2. **Run Development Server**
   ```bash
   yarn dev
   ```

3. **Build for Production**
   ```bash
   yarn build
   ```

4. **Run Tests**
   ```bash
   yarn test
   ```

## Game Rules

1.  **Objective**: Meld all cards in your hand. The game ends when you discard your last card.
2.  **Round 1 & 2**: Draw and Discard only. No melding allowed.
3.  **Round 3+**: Melding becomes available.
4.  **Opening**: To place your first melds, you must have at least **36 Points** total, and at least one **Pure Run** (Straight Flush with no Jokers).
5.  **Melds**:
    *   **Set**: 3 or 4 cards of the same rank (e.g., 5♥, 5♠, 5♣).
    *   **Run**: 3+ consecutive cards of the same suit (e.g., 4♦, 5♦, 6♦).
6.  **Jokers**: Can replace any card. Cannot be placed adjacent to each other in a meld.
7.  **Ace Values**:
    *   **1 Point**: In a low run (A-2-3).
    *   **10 Points**: In a high run (Q-K-A) or Set.
8.  **Jolly Hand**: If you have 12 cards and the deck's bottom card is available, you can take it to win immediately (if you can meld your entire hand).

## Architecture

- **Core**: Pure TypeScript logic for Cards, Deck, AI, and Rules (`src/core/`).
- **State**: `GameState` class manages the source of truth.
- **View**: `UIManager` handles DOM manipulation and rendering.
