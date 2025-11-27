import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../src/GameState';
import { Card } from '../src/core/Card';
import { organizeMeld } from '../src/core/rules';

describe('GameState & Game Logic Actions', () => {
    let game: GameState;

    beforeEach(() => {
        game = new GameState();
        game.initGame();
        // Setup standard Action Phase
        game.round = 3;
        game.phase = 'action';
    });

    describe('Initialization & State', () => {
        it('should initialize with correct hand sizes', () => {
            // Re-init to check start state
            game.initGame(); 
            expect(game.pHand.length).toBe(13);
            expect(game.cHand.length).toBe(12);
            expect(game.round).toBe(1);
            expect(game.phase).toBe('action'); // Starts action to allow first discard
        });

        it('should allow setting difficulty', () => {
            game.setDifficulty('hard');
            expect(game.difficulty).toBe('hard');
        });

        it('should handle debug initialization', () => {
             // Init with debug flag
             game.initGame(true);
             // Debug hand has specific cards (Q♥, K♥, A♥...)
             const qh = game.pHand.find(c => c.rank === 'Q' && c.suit === '♥');
             expect(qh).toBeDefined();
        });
    });

    describe('Hand Manipulation', () => {
        it('should reorder hand correctly', () => {
             const c1 = game.pHand[0];
             const c2 = game.pHand[1];
             game.reorderHand(0, 1);
             expect(game.pHand[1].id).toBe(c1.id);
        });

        it('should ignore reorder out of bounds', () => {
             const len = game.pHand.length;
             game.reorderHand(0, 999); // Should just move to end or safe
             expect(game.pHand.length).toBe(len);
             
             game.reorderHand(-1, 0); // Invalid
             expect(game.pHand.length).toBe(len);
        });

        it('should debug replace card', () => {
             const target = game.pHand[0];
             const originalId = target.id;
             game.debugReplaceCard(originalId, 'A', '♠');
             
             const newCard = game.pHand[0];
             expect(newCard.id).not.toBe(originalId);
             expect(newCard.rank).toBe('A');
             expect(newCard.suit).toBe('♠');
        });

        it('should ignore debug replace if ID not found', () => {
             const originalFirst = game.pHand[0];
             game.debugReplaceCard(99999, 'A', '♠');
             expect(game.pHand[0]).toBe(originalFirst);
        });
    });

    describe('CPU Turn Execution (CpuActions)', () => {
        it('should execute a basic CPU turn (Draw & Discard)', () => {
             game.turn = 'cpu';
             // Give CPU a junk hand to force discard
             game.cHand = [new Card('♥', '2', 1), new Card('♠', '9', 2)];
             
             const res = game.processCpuTurn();
             
             expect(res.discardedCard).toBeDefined();
             expect(game.discardPile.length).toBeGreaterThan(0);
             // Ensure phase flipped back to Human Draw
             expect(game.turn).toBe('human');
             expect(game.phase).toBe('draw');
        });

        it('should execute CPU win if hand empty', () => {
             game.turn = 'cpu';
             game.cHand = [new Card('♥', 'K', 1)]; // One card left
             
             const res = game.processCpuTurn();
             
             expect(res.winner).toBe('CPU');
             expect(res.discardedCard).toBeDefined();
             expect(game.cHand.length).toBe(0);
        });

        it('should play Melds if Hard difficulty and available', () => {
             game.turn = 'cpu';
             game.difficulty = 'hard';
             game.round = 3;
             
             // CPU Hand: Valid Set of Kings
             game.cHand = [
                 new Card('♥', 'K', 1), new Card('♦', 'K', 2), new Card('♣', 'K', 3),
                 new Card('♠', '2', 4) // Discard
             ];
             // Setup open requirements satisfaction logic or force open
             // For simplicity, we can rely on AI logic finding the meld. 
             // Note: calculateCpuMove checks opening logic. 
             // 3 Kings = 30 pts. Need 36 + Pure Run? 
             // AI might fail to open if points not enough.
             // Let's give enough for Open: Pure Run (30) + Set (30)
             game.cHand = [
                 new Card('♥', 'Q', 1), new Card('♥', 'K', 2), new Card('♥', 'A', 3), // Pure Run
                 new Card('♠', 'K', 4), new Card('♦', 'K', 5), new Card('♣', 'K', 6), // Set
                 new Card('♣', '2', 7) // Discard
             ];

             const res = game.processCpuTurn();
             
             expect(res.meldsPlayed!.length).toBeGreaterThan(0);
             expect(game.melds.length).toBeGreaterThan(0);
             expect(game.hasOpened.cpu).toBe(true);
        });
    });

    describe('Meld Actions (Adding & Swapping)', () => {
        it('should validate adding to existing meld', () => {
             // Setup existing meld
             game.melds.push([new Card('♥', '5', 1), new Card('♥', '6', 2), new Card('♥', '7', 3)]);
             game.hasOpened.human = true;
             
             // Hand has 8♥
             const c = new Card('♥', '8', 10);
             game.pHand.push(c);
             
             const res = game.addToExistingMeld(0, [c]);
             expect(res.success).toBe(true);
             expect(game.melds[0].length).toBe(4);
        });

        it('should FAIL adding to meld if card invalid', () => {
             game.melds.push([new Card('♥', '5', 1), new Card('♥', '6', 2), new Card('♥', '7', 3)]);
             game.hasOpened.human = true;
             
             const c = new Card('♠', '8', 10); // Wrong suit
             game.pHand.push(c);
             
             const res = game.addToExistingMeld(0, [c]);
             expect(res.success).toBe(false);
        });

        it('should FAIL adding if not opened and meld is old', () => {
             game.melds.push([new Card('♥', '5', 1)]); // Dummy
             game.hasOpened.human = false;
             
             const c = new Card('♥', '6', 10);
             game.pHand.push(c);
             
             const res = game.addToExistingMeld(0, [c]);
             expect(res.success).toBe(false);
             expect(res.msg).toContain('Must open');
        });

        it('should cancel turn melds correctly', () => {
             // Simulate a turn action
             game.hasOpened.human = true;
             const m = [new Card('♥', '5', 1), new Card('♥', '6', 2), new Card('♥', '7', 3)];
             game.pHand.push(...m);
             
             game.attemptMeld(m);
             expect(game.melds.length).toBe(1);
             expect(game.turnMelds.length).toBe(1);
             
             game.cancelTurnMelds();
             
             expect(game.melds.length).toBe(0);
             expect(game.pHand.length).toBeGreaterThan(0); // Cards returned
             expect(game.turnMelds.length).toBe(0);
        });
        
        it('should revert additions when cancelling', () => {
             game.hasOpened.human = true;
             game.melds.push([new Card('♥', '5', 1), new Card('♥', '6', 2), new Card('♥', '7', 3)]);
             
             const c = new Card('♥', '8', 10);
             game.pHand.push(c);
             
             game.addToExistingMeld(0, [c]);
             expect(game.melds[0].length).toBe(4);
             
             game.cancelTurnMelds();
             expect(game.melds[0].length).toBe(3);
             expect(game.pHand.some(x => x.id === 10)).toBe(true);
        });
    });
    
    describe('Jolly Actions', () => {
         it('should return error if round < 3', () => {
              game.round = 1;
              const res = game.attemptJollyHand();
              expect(res.success).toBe(false);
              expect(res.msg).toContain('Round 3');
         });
         
         it('should return error if already opened', () => {
              game.hasOpened.human = true;
              const res = game.attemptJollyHand();
              expect(res.success).toBe(false);
              expect(res.msg).toContain('opening');
         });
         
         it('should return error if hand size != 12', () => {
              game.pHand = [new Card('♥', 'A', 1)];
              const res = game.attemptJollyHand();
              expect(res.success).toBe(false);
              expect(res.msg).toContain('12 cards');
         });
    });
});
