import { GameState } from "./GameState";
import { UIManager } from "./UIManager";
import "./style.css";

const game = new GameState();
const ui = new UIManager(game);

const HELP_HTML = `
<b>Jolly Rules:</b><br><br>
1. <b>Opening:</b> You must have at least one Pure Run (Straight Flush without Jokers) and total meld points of 36+ to open.<br><br>
2. <b>Melds:</b><br>
   - Sets: 3 or 4 cards of same rank (different suits).<br>
   - Runs: 3+ consecutive cards of same suit.<br><br>
3. <b>Ace Values:</b><br>
   - 1 point in A-2-3 run.<br>
   - 10 points in Q-K-A run or Sets.<br><br>
4. <b>Jolly Hand:</b> If you have 12 cards and can take the bottom card to meld EVERYTHING at once, you win immediately.<br><br>
5. <b>Jokers:</b> Can replace any card. Swap them from table if you have the card they represent.
`;

const App = {
    init: () => {
        game.initGame();
        ui.render();
        ui.updateStatus("Your turn. Draw a card.");
    },

    showHelp: () => {
        ui.showAlert(HELP_HTML, "Help Topics", "❓", true);
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
        const res = game.undoDraw();
        if (res.success) {
            ui.render();
            ui.updateStatus("Draw undone. Select a pile.");
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
        game.cancelTurnMelds();
        ui.render();
        ui.updateStatus("Melds cancelled.");
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
(window as any).closeAlert = App.closeAlert;

App.init();
