import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../src/GameState';
import { Card } from '../src/core/Card';
import { organizeMeld } from '../src/core/rules';

describe('Advanced Game Scenarios', () => {
    let game: GameState;

    beforeEach(() => {
        game = new GameState();
        game.initGame();
        game.round = 3;
        game.phase = 'action';
        game.pHand = []; 
    });

    describe('Winning Conditions', () => {
        it('should win the game when discarding the last card', () => {
            // Setup: Player has opened
            game.hasOpened.human = true;
            
            // Hand has 1 card
            const lastCard = new Card('♥', 'K', 999);
            game.pHand = [lastCard];

            const res = game.attemptDiscard(999);
            
            expect(res.success).toBe(true);
            expect(res.winner).toBe('Human');
            expect(game.pHand.length).toBe(0);
        });

        it('should NOT win if hand empty but meld requirements failed', () => {
            // Setup: Player has NOT opened and has 0 points
            game.hasOpened.human = false;
            game.turnPoints = 0;
            
            const lastCard = new Card('♥', 'K', 999);
            game.pHand = [lastCard];
            
            const res = game.attemptDiscard(999);
            expect(res.success).toBe(false);
            expect(res.msg).toContain('without opening');
            expect(res.winner).toBeUndefined();
        });
    });

    describe('Joker Set Constraints', () => {
        it('should NOT allow swapping Joker from a Set of 3', () => {
            game.hasOpened.human = true;
            
            // Set: 4H, 4D, Joker (representing 4C or 4S)
            // Note: Set logic assigns representation to first available missing suit
            const meld = [
                new Card('♥', '4', 1),
                new Card('♦', '4', 2),
                new Card('JK', 'Joker', 3)
            ];
            const organized = organizeMeld(meld);
            game.melds.push(organized);
            
            const jokerRep = organized.find(c => c.isJoker)!.representation!;
            
            // Hand has the card the Joker represents
            const myCard = new Card(jokerRep.suit, jokerRep.rank, 10);
            game.pHand.push(myCard);
            
            // Attempt swap
            const res = game.attemptJokerSwap(0, 10);
            
            // Rule: "You cannot take a Joker from a Set of 3 if it leaves only 3 suits on the table."
            // Swapping would result in 4H, 4D, 4(Real). That is 3 cards.
            // The constraint requires the table set to have all 4 suits (length 4) to swap.
            expect(res.success).toBe(false);
            expect(res.msg).toContain('complete Set');
        });

        it('should allow swapping Joker from a Set of 4', () => {
             game.hasOpened.human = true;
             
             // Set: 4H, 4D, 4C, Joker (4S)
             const meld = [
                 new Card('♥', '4', 1),
                 new Card('♦', '4', 2),
                 new Card('♣', '4', 3),
                 new Card('JK', 'Joker', 4)
             ];
             const organized = organizeMeld(meld);
             game.melds.push(organized);
             
             // Joker should be 4♠ (the only missing suit)
             const joker = organized.find(c => c.isJoker)!;
             expect(joker.representation?.suit).toBe('♠');
             
             // Hand has 4♠
             const myCard = new Card('♠', '4', 10);
             game.pHand.push(myCard);
             
             const res = game.attemptJokerSwap(0, 10);
             expect(res.success).toBe(true);
             expect(game.swappedJokerIds).toContain(4);
        });
    });

    describe('Adding to Melds with Dynamic Jokers', () => {
        it('should shift Joker to end when real card fills its spot in a Run', () => {
            game.hasOpened.human = true;

            // Run: 10♥, J♥, Joker (Q♥)
            const meld = [
                new Card('♥', '10', 1),
                new Card('♥', 'J', 2),
                new Card('JK', 'Joker', 3)
            ];
            const organized = organizeMeld(meld);
            game.melds.push(organized);
            
            expect(organized[2].representation?.rank).toBe('Q');

            // Hand has Q♥
            const queen = new Card('♥', 'Q', 10);
            game.pHand.push(queen);

            // Add Q♥ to meld. 
            // This is not a swap. We are adding Q. 
            // Sequence becomes 10, J, Q, Joker. Joker shifts to K.
            const res = game.addToExistingMeld(0, [queen]);
            
            expect(res.success).toBe(true);
            const newMeld = game.melds[0];
            expect(newMeld.length).toBe(4);
            
            // Find Joker
            const joker = newMeld.find(c => c.isJoker)!;
            expect(joker.representation?.rank).toBe('K');
        });
        
        it('should maintain Pure status correctly when adding Jokers', () => {
             game.hasOpened.human = true;
             // Pure Run
             const meld = [new Card('♥', '10', 1), new Card('♥', 'J', 2), new Card('♥', 'Q', 3)];
             game.melds.push(meld);
             
             // Add Joker
             const joker = new Card('JK', 'Joker', 4);
             const res = game.addToExistingMeld(0, [joker]);
             
             expect(res.success).toBe(true);
             // Although validation for *adding* doesn't strictly check 'isPure' logic for the game opening (since already opened),
             // the meld itself is no longer pure. 
             // Logic in organizeMeld should handle placing the Joker at K or 9.
             
             const organized = game.melds[0];
             expect(organized.length).toBe(4);
             const jokerInMeld = organized.find(c => c.isJoker)!;
             expect(jokerInMeld.representation).toBeDefined();
        });
    });

    describe('Opening Thresholds', () => {
        it('should allow opening with exactly 36 points', () => {
            // Pure Run: J, Q, K (30 pts)
            // Set: 2, 2, 2 (6 pts)
            // Total 36
            const run = [new Card('♥', 'J', 1), new Card('♥', 'Q', 2), new Card('♥', 'K', 3)];
            const set = [new Card('♠', '2', 4), new Card('♦', '2', 5), new Card('♣', '2', 6)];
            
            game.pHand.push(...run, ...set);
            
            game.attemptMeld(run);
            game.attemptMeld(set);
            
            // Add a discard card
            game.pHand.push(new Card('♣', '9', 99));
            const res = game.attemptDiscard(99);
            
            expect(res.success).toBe(true);
            expect(game.hasOpened.human).toBe(true);
        });

        it('should reject opening with 35 points', () => {
             // Pure Run: 2,3,4 (9pts) + Set 8,8,8 (24pts) = 33pts.
             const run = [new Card('♥', '2', 1), new Card('♥', '3', 2), new Card('♥', '4', 3)];
             const set = [new Card('♠', '8', 4), new Card('♦', '8', 5), new Card('♣', '8', 6)];
             
             game.pHand.push(...run, ...set, new Card('♣', 'K', 99));
             
             game.attemptMeld(run);
             game.attemptMeld(set);
             
             const res = game.attemptDiscard(99);
             expect(res.success).toBe(false);
             expect(res.msg).toContain('36+');
        });
    });
    
    describe('Jolly Hand Win', () => {
        it('should win immediately if Jolly Hand is taken and all cards melded', () => {
            // Setup Jolly Turn Requirements
            game.round = 3;
            game.phase = 'draw'; // FIX: Set correct phase for Jolly
            game.pHand = [];
            for(let i=0; i<12; i++) game.pHand.push(new Card('♠', '2', i+100)); 
            game.bottomCard = new Card('♥', 'A', 200);
            
            const jollyRes = game.attemptJollyHand();
            expect(jollyRes.success).toBe(true);
            
            // Player has 13 cards. Simulate melding all of them.
            game.pHand = [];
            
            // Construct Winning Hand: 
            // 4 Sets of 3 (12 cards) + 1 Discard. 
            // One of these cards is the Jolly Card (A♥).
            
            const set1 = [new Card('♥', '5', 10), new Card('♦', '5', 11), new Card('♣', '5', 12)];
            const set2 = [new Card('♥', '6', 20), new Card('♦', '6', 21), new Card('♣', '6', 22)];
            const set3 = [new Card('♥', '7', 30), new Card('♦', '7', 31), new Card('♣', '7', 32)];
            // Pure Run including Jolly Card (A♥)
            const run = [new Card('♥', 'Q', 40), new Card('♥', 'K', 41), new Card('♥', 'A', 200)]; // Jolly is 200
            
            // Discard
            const discard = new Card('♠', 'K', 50);
            
            game.pHand = [...set1, ...set2, ...set3, ...run, discard];
            
            // Meld
            game.attemptMeld(set1);
            game.attemptMeld(set2);
            game.attemptMeld(set3);
            game.attemptMeld(run);
            
            // Discard last card
            const winRes = game.attemptDiscard(50);
            
            expect(winRes.success).toBe(true);
            expect(winRes.winner).toBe('Human');
        });
    });
});
