import { describe, it, expect } from 'vitest';
import { validateMeld } from '../src/core/rules';
import { Card } from '../src/core/Card';

describe('Jolly Rules', () => {
    const c = (r: any, s: any) => new Card(s, r, Math.random());
    const joker = () => new Card('JK', 'Joker', Math.random());

    describe('Ace Values', () => {
        it('Ace should count as 1 in A-2-3 run', () => {
            const cards = [c('A', '♥'), c('2', '♥'), c('3', '♥')];
            // sort normally A is high rank, so we rely on validate logic sorting
            const res = validateMeld(cards);
            expect(res.valid).toBe(true);
            // 1 + 2 + 3 = 6
            expect(res.points).toBe(6); 
        });

        it('Ace should count as 10 in Q-K-A run', () => {
            const cards = [c('Q', '♥'), c('K', '♥'), c('A', '♥')];
            const res = validateMeld(cards);
            expect(res.valid).toBe(true);
            // 10 + 10 + 10 = 30
            expect(res.points).toBe(30);
        });

        it('Ace should count as 10 in Sets', () => {
            const cards = [c('A', '♥'), c('A', '♠'), c('A', '♣')];
            const res = validateMeld(cards);
            expect(res.valid).toBe(true);
            expect(res.points).toBe(30);
        });
    });

    describe('Straight Flush Run (Pure)', () => {
        it('should identify pure runs', () => {
            const cards = [c('5', '♦'), c('6', '♦'), c('7', '♦')];
            const res = validateMeld(cards);
            expect(res.valid).toBe(true);
            expect(res.type).toBe('run');
            expect(res.isPure).toBe(true);
        });

        it('should mark run with Joker as impure', () => {
            const cards = [c('5', '♦'), joker(), c('7', '♦')];
            const res = validateMeld(cards);
            expect(res.valid).toBe(true);
            expect(res.isPure).toBe(false);
        });
    });

    describe('Joker Adjacency', () => {
        it('should reject two adjacent jokers', () => {
            const cards = [c('5', '♦'), joker(), joker(), c('8', '♦')];
            const res = validateMeld(cards);
            expect(res.valid).toBe(false);
        });
    });
});
