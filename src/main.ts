import { GameState } from "./GameState";
import { UIManager } from "./UIManager";
import "./style.css";

const game = new GameState();
const ui = new UIManager(game);

const App = {
    init: () => {
        game.initGame();
        ui.render();
        ui.updateStatus("Your turn. Discard a card to start.");
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
            if (res.msg) alert(res.msg);
        }
    },

    humanMeld: () => {
        const selected = game.pHand.filter(c => c.selected);
        const res = game.attemptMeld(selected);
        
        if (res.success) {
            ui.render();
            if (!game.hasOpened.human) {
                ui.updateStatus(`Pending Opening. Need Pure Run + 36pts. Current: ${game.turnPoints}`);
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
                ui.showWinModal(`${res.winner} Wins! Opponent score: ${res.score}`);
                return;
            }
            
            ui.render();
            ui.updateStatus("CPU is thinking...");
            
            setTimeout(() => {
                const cpuRes = game.processCpuTurn();
                if (cpuRes.winner) {
                    ui.showWinModal(`${cpuRes.winner} Wins! You lose ${cpuRes.score} pts.`);
                }
                ui.render();
                ui.updateStatus(`Round ${game.round}. Your turn.`);
            }, 1000);

        } else {
            alert(res.msg);
        }
    },

    attemptJolly: () => {
        const res = game.attemptJollyHand();
        if(res.success) {
            ui.render();
            ui.updateStatus(res.msg || "Jolly Hand Active!");
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

(window as any).game = App;
(window as any).closeModal = App.closeModal;

App.init();
