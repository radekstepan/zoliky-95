import { GameState } from "./GameState";
import { UIManager } from "./UIManager";
import "./style.css";

// Initialize Core and View
const game = new GameState();
const ui = new UIManager(game);

// Global Logic Handlers exposed for the HTML inline onclicks 
// (Note: In a pure React/Vue app we wouldn't attach to window, but this matches the existing structure)

const App = {
    init: () => {
        game.initGame();
        ui.render();
        ui.updateStatus("Your turn. Draw a card.");
    },

    humanDraw: (source: 'stock' | 'discard') => {
        const res = game.drawCard(source);
        if (res.success && res.card) {
            // Render first to create DOM element for animation
            ui.render(); 
            ui.animateDraw(res.card, source, () => {
                let msg = "Meld cards or Discard to end turn.";
                if (game.drawnFromDiscardId) msg = "You drew from discard. You MUST meld this card!";
                ui.updateStatus(msg);
            });
        } else {
            if (res.msg) alert(res.msg);
        }
    },

    humanMeld: () => {
        const selected = game.pHand.filter(c => c.selected);
        const res = game.attemptMeld(selected);
        
        if (res.success) {
            if (game.pHand.length === 0) {
                ui.showWinModal("Human Wins!");
            } else {
                ui.render();
                if (!game.hasOpened.human) {
                    ui.updateStatus(`Pending Opening Points: ${game.turnPoints}/36.`);
                }
            }
        } else {
            alert(res.msg);
        }
    },

    humanDiscard: () => {
        const selected = game.pHand.filter(c => c.selected);
        if (selected.length !== 1) {
            alert("Select exactly one card.");
            return;
        }

        const res = game.attemptDiscard(selected[0].id);
        if (res.success) {
            if (res.winner) {
                ui.showWinModal(`${res.winner} Wins!`);
                return;
            }
            
            ui.render();
            ui.updateStatus("CPU is thinking...");
            
            setTimeout(() => {
                const cpuRes = game.processCpuTurn();
                if (cpuRes.winner) {
                    ui.showWinModal(`${cpuRes.winner} Wins!`);
                }
                ui.render();
                ui.updateStatus(`Round ${game.round}. Your turn.`);
            }, 1000);

        } else {
            alert(res.msg);
        }
    },

    cancelMelds: () => {
        game.cancelTurnMelds();
        ui.render();
        ui.updateStatus("Melds cancelled.");
    },

    closeModal: () => {
        ui.closeWinModal();
    }
};

// Attach to Window
(window as any).game = App;
(window as any).closeModal = App.closeModal;

// Start
App.init();
