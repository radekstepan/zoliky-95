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
        // Just show the start screen initially
        App.showStartScreen();
    },

    showStartScreen: () => {
        const el = document.getElementById('start-screen');
        if (el) el.style.display = 'flex';
        // Ensure other modals are closed
        ui.closeWinModal();
        ui.closeAlert();
        ui.closeDebugModal();
        // Clear board visually (render empty game state or just hide logic)
        // Since game state persists, we just cover it with overlay.
    },

    startGameFromUI: () => {
        // Get difficulty
        const radios = document.getElementsByName('difficulty');
        let diff: Difficulty = 'medium';
        for (const r of radios) {
            if ((r as HTMLInputElement).checked) {
                diff = (r as HTMLInputElement).value as Difficulty;
                break;
            }
        }

        // Setup Game
        const isDebug = new URLSearchParams(window.location.search).has('debug');
        game.initGame(isDebug);
        game.setDifficulty(diff);
        
        // Hide Start Screen
        const el = document.getElementById('start-screen');
        if (el) el.style.display = 'none';

        // DEAL ANIMATION
        ui.animateDeal(() => {
             ui.updateStatus(`Game Started. Difficulty: ${diff.toUpperCase()}. Discard a card to start.`);
        });
    },

    showHelp: () => {
        ui.showAlert(HELP_HTML, "Help Topics", "❓", true);
    },

    // --- Dropdown Logic ---
    toggleDropdown: (type: 'rank' | 'suit') => {
        const list = document.getElementById(`combo-${type}-list`);
        if (list) {
            const isVisible = list.style.display === 'block';
            // Hide all first
            document.getElementById('combo-rank-list')!.style.display = 'none';
            document.getElementById('combo-suit-list')!.style.display = 'none';
            
            if (!isVisible) list.style.display = 'block';
        }
    },

    selectDropdownOption: (type: 'rank' | 'suit', value: string, text: string) => {
        const container = document.getElementById(`combo-${type}`);
        const display = document.getElementById(`combo-${type}-text`);
        const list = document.getElementById(`combo-${type}-list`);
        
        if (container) container.dataset.value = value;
        if (display) display.innerText = text;
        if (list) list.style.display = 'none';
    },

    submitDebugSwap: () => {
        const uiInstance = (window as any).game_ui as UIManager;
        if (!uiInstance.debugSwapCardId) return;
        
        // Get values from custom dropdowns
        const rankEl = document.getElementById('combo-rank');
        const suitEl = document.getElementById('combo-suit');
        
        let rank = rankEl?.dataset.value || '2';
        let suit = suitEl?.dataset.value || '♥';
        
        // Validate Joker logic
        if (rank === 'Joker' && suit !== 'JK') suit = 'JK';
        if (suit === 'JK' && rank !== 'Joker') rank = 'Joker';

        game.debugReplaceCard(uiInstance.debugSwapCardId, rank as any, suit as any);
        uiInstance.closeDebugModal();
        uiInstance.render();
    },

    closeDebugModal: () => {
        const uiInstance = (window as any).game_ui as UIManager;
        uiInstance.closeDebugModal();
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
        const cardId = game.drawnFromDiscardId;
        if (!cardId) return;

        const cardEl = ui.getCardElement(cardId);
        const startRect = cardEl ? cardEl.getBoundingClientRect() : null;

        const res = game.undoDraw();
        
        if (res.success) {
            ui.render();
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
        const startRects: Record<number, DOMRect> = {};
        selected.forEach(c => {
            const el = ui.getCardElement(c.id);
            if (el) startRects[c.id] = el.getBoundingClientRect();
        });

        const res = game.attemptMeld(selected);

        if (res.success) {
            ui.render();
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

                    const handleCpuFinish = () => {
                        const dCard = cpuRes.discardedCard;
                        const isWin = !!cpuRes.winner;

                        if (dCard) {
                            // 1. Revert discard in GameState temporarily
                            game.discardPile.pop(); 
                            game.cHand.push(dCard);
                        }

                        // 2. Render table with new melds (but discard reverted)
                        ui.render();

                        // 3. Animate CPU melds
                        const meldsPlayed = cpuRes.meldsPlayed || [];
                        ui.animateCpuMelds(meldsPlayed, () => {
                            
                            // 4. Proceed to Discard after Melds Done
                            if (dCard) {
                                // Re-apply discard
                                game.cHand = game.cHand.filter(c => c.id !== dCard.id);
                                game.discardPile.push(dCard);

                                if (isWin) {
                                    ui.render();
                                    const winCard = document.querySelector('.winning-discard') as HTMLElement;
                                    if (winCard) winCard.style.opacity = '0';
                                    
                                    ui.animateCpuDiscard(dCard, () => {
                                        if (cpuRes.winner) {
                                            ui.showWinModal(`${cpuRes.winner} Wins! You lose ${cpuRes.score} pts.`);
                                        }
                                        ui.render();
                                        ui.updateStatus(`Round ${game.round}. Your turn.`);
                                    }, isWin);
                                } else {
                                    ui.animateCpuDiscard(dCard, () => {
                                        ui.render();
                                        ui.updateStatus(`Round ${game.round}. Your turn.`);
                                    }, isWin);
                                }
                            } else {
                                ui.render();
                                if (cpuRes.winner) {
                                    ui.showWinModal(`${cpuRes.winner} Wins! You lose ${cpuRes.score} pts.`);
                                }
                                ui.updateStatus(`Round ${game.round}. Your turn.`);
                            }
                        });
                    };

                    if (cpuRes.drawSource) {
                        ui.animateCpuDraw(cpuRes.drawSource, handleCpuFinish);
                    } else {
                        handleCpuFinish();
                    }
                }, 1000);
            };

            if (startRect) {
                ui.animateDiscard(card, startRect, finishTurn, !!res.winner);
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
        const cardIds = game.getTurnActiveCardIds();
        const startRects = ui.captureCardPositions(cardIds);

        game.cancelTurnMelds();
        
        ui.render();
        
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
(window as any).game_ui = ui; // Expose UI to global for helper access if needed
(window as any).closeModal = App.closeModal;
(window as any).closeAlert = App.closeAlert;

App.init();
