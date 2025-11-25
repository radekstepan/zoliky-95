import { GameState } from "./GameState";
import { UIManager } from "./UIManager";
import { Difficulty } from "./types";
import "./style.css";

const game = new GameState();
const ui = new UIManager(game);

const HELP_HTML = `
<b>Jolly Rules:</b><br/>
1. <b>Opening:</b> You must have at least one Pure Run (Straight Flush without Jokers) and total meld points of 36+ to open.
2. <b>Melds:</b>
   - Sets: 3 or 4 cards of same rank (different suits).
   - Runs: 3+ consecutive cards of same suit.
3. <b>Ace Values:</b>
   - 1 point in A-2-3 run.
   - 10 points in Q-K-A run or Sets.
4. <b>Jolly Hand:</b> If you have 12 cards and can take the bottom card to meld EVERYTHING at once, you win immediately.
5. <b>Jokers:</b> Can replace any card. Swap them from table if you have the card they represent.
`;

const App = {
    init: () => {
        game.initGame();
        ui.render();
        ui.updateStatus("Your turn. Draw a card.");
        App.updateDifficultyUI();
    },

    showHelp: () => {
        ui.showAlert(HELP_HTML, "Help Topics", "❓", true);
    },

    toggleDifficultyMenu: () => {
        const el = document.getElementById('difficulty-menu');
        if (el) {
            // Ensure UI is current before showing
            App.updateDifficultyUI();
            el.style.display = el.style.display === 'none' ? 'block' : 'none';
        }
    },

    setDifficulty: (level: Difficulty) => {
        game.setDifficulty(level);
        ui.updateStatus(`Difficulty set to: ${level.toUpperCase()}`);
        
        const el = document.getElementById('difficulty-menu');
        if (el) el.style.display = 'none';
        
        App.updateDifficultyUI();
    },

    updateDifficultyUI: () => {
        const levels: {key: Difficulty, label: string}[] = [
            { key: 'easy', label: 'Easy (Novice)' },
            { key: 'medium', label: 'Medium (Casual)' },
            { key: 'hard', label: 'Hard (Pro)' }
        ];

        levels.forEach(lvl => {
            const el = document.getElementById(`menu-diff-${lvl.key}`);
            if (el) {
                // Add checkmark if selected, otherwise spacer to keep alignment
                const prefix = (game.difficulty === lvl.key) ? "✓ " : "\u00A0\u00A0\u00A0"; // \u00A0 is &nbsp;
                el.innerText = prefix + lvl.label;
            }
        });
    },

    humanDraw: (source: 'stock' | 'discard') => {
        const res = game.drawCard(source);
        if (res.success && res.card) {
            ui.render();
            ui.animateDraw(res.card, source, () => {
                let msg = "Meld cards or Discard to end turn.";
                if (game.drawnFromDiscardId) msg = "You drew from discard. You MUST meld this card!";
                ui.updateStatus(msg);
            });
        } else {
            if (res.msg) ui.showAlert(res.msg);
        }
    },

    undoDraw: () => {
        // 1. Capture state before undo
        const cardId = game.drawnFromDiscardId;
        if (!cardId) return;

        const cardEl = ui.getCardElement(cardId);
        const startRect = cardEl ? cardEl.getBoundingClientRect() : null;

        // 2. Perform Undo Logic
        const res = game.undoDraw();
        
        if (res.success) {
            // 3. Render (card moves to discard)
            ui.render();
            
            // 4. Animate visual return
            if (startRect) {
                ui.animateUndoDraw(startRect, () => {
                    ui.updateStatus("Draw undone. Select a pile.");
                });
            } else {
                ui.updateStatus("Draw undone. Select a pile.");
            }
        } else {
            ui.showAlert(res.msg || "Cannot undo");
        }
    },

    humanMeld: () => {
        const selected = game.pHand.filter(c => c.selected);
        // Capture Rects before Logic
        const startRects: Record<number, DOMRect> = {};
        selected.forEach(c => {
            const el = ui.getCardElement(c.id);
            if (el) startRects[c.id] = el.getBoundingClientRect();
        });

        const res = game.attemptMeld(selected);

        if (res.success) {
            ui.render();
            // The new meld is the last one
            const newMeldIndex = game.melds.length - 1;
            ui.animateToMeld(selected, startRects, newMeldIndex, () => { });

            if (!game.hasOpened.human) {
                ui.updateStatus(`Pending Opening. Need Pure Run + 36pts. Current: ${game.turnPoints}`);
            }
        } else {
            ui.showAlert(res.msg || "Invalid Meld");
        }
    },

    humanDiscard: () => {
        const selected = game.pHand.filter(c => c.selected);
        if (selected.length !== 1) {
            ui.showAlert("Select exactly one card to discard.");
            return;
        }

        const card = selected[0];
        const cardEl = ui.getCardElement(card.id);
        const startRect = cardEl ? cardEl.getBoundingClientRect() : null;

        const res = game.attemptDiscard(card.id);
        if (res.success) {
            ui.render();

            const finishTurn = () => {
                if (res.winner) {
                    ui.showWinModal(`${res.winner} Wins! Opponent score: ${res.score}`);
                    return;
                }

                ui.updateStatus("CPU is thinking...");
                setTimeout(() => {
                    const cpuRes = game.processCpuTurn();

                    // Animate CPU draw first
                    if (cpuRes.drawSource) {
                        ui.animateCpuDraw(cpuRes.drawSource, () => {
                            // Then animate CPU discard if there was one
                            if (cpuRes.discardedCard) {
                                ui.animateCpuDiscard(cpuRes.discardedCard, () => {
                                    if (cpuRes.winner) {
                                        ui.showWinModal(`${cpuRes.winner} Wins! You lose ${cpuRes.score} pts.`);
                                    }
                                    ui.render();
                                    ui.updateStatus(`Round ${game.round}. Your turn.`);
                                });
                            } else {
                                if (cpuRes.winner) {
                                    ui.showWinModal(`${cpuRes.winner} Wins! You lose ${cpuRes.score} pts.`);
                                }
                                ui.render();
                                ui.updateStatus(`Round ${game.round}. Your turn.`);
                            }
                        });
                    } else {
                        // Fallback if no drawSource (shouldn't happen)
                        if (cpuRes.discardedCard) {
                            ui.animateCpuDiscard(cpuRes.discardedCard, () => {
                                if (cpuRes.winner) {
                                    ui.showWinModal(`${cpuRes.winner} Wins! You lose ${cpuRes.score} pts.`);
                                }
                                ui.render();
                                ui.updateStatus(`Round ${game.round}. Your turn.`);
                            });
                        } else {
                            if (cpuRes.winner) {
                                ui.showWinModal(`${cpuRes.winner} Wins! You lose ${cpuRes.score} pts.`);
                            }
                            ui.render();
                            ui.updateStatus(`Round ${game.round}. Your turn.`);
                        }
                    }
                }, 1000);
            };

            if (startRect) {
                ui.animateDiscard(card, startRect, finishTurn);
            } else {
                finishTurn();
            }

        } else {
            ui.showAlert(res.msg || "Cannot discard");
        }
    },

    attemptJolly: () => {
        const res = game.attemptJollyHand();
        if (res.success) {
            ui.render();
            ui.updateStatus(res.msg || "Jolly Hand Active!");
            ui.sound.playWin();
        } else {
            ui.showAlert(res.msg || "Conditions not met");
        }
    },

    cancelMelds: () => {
        // 1. Capture positions of cards to be cancelled (from Table)
        const cardIds = game.getTurnActiveCardIds();
        const startRects = ui.captureCardPositions(cardIds);

        // 2. Perform Logic
        game.cancelTurnMelds();
        
        // 3. Render (cards move to Hand)
        ui.render();
        
        // 4. Animate Return
        ui.animateReturnToHand(cardIds, startRects, () => {
            ui.updateStatus("Melds cancelled.");
        });
    },

    closeModal: () => {
        ui.closeWinModal();
    },

    closeAlert: () => {
        ui.closeAlert();
    }
};

(window as any).game = App;
(window as any).closeModal = App.closeModal;
(window as any).closeAlert = App.closeAlert;

App.init();
