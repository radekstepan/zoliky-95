import { GameState } from "./GameState";
import { UIManager } from "./UIManager";
import "./style.css";

const game = new GameState();
const ui = new UIManager(game);

const HELP_TEXT = `Jolly Rules:

1. Opening: You must have at least one Pure Run (Straight Flush without Jokers) and total meld points of 36+ to open.

2. Melds:
   - Sets: 3 or 4 cards of same rank.
   - Runs: 3+ consecutive cards of same suit.

3. Ace Values:
   - 1 point in A-2-3 run.
   - 10 points in Q-K-A run or Sets.

4. Jolly Hand: If you have 12 cards and can take the bottom card to meld EVERYTHING at once, you win immediately.

5. Jokers: Can replace any card. Swap them from table if you have the card they represent.`;

const App = {
    init: () => {
        game.initGame();
        ui.render();
        ui.updateStatus("Your turn. Discard a card to start.");
    },

    showHelp: () => {
        ui.showAlert(HELP_TEXT, "Help Topics");
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

    humanMeld: () => {
        const selected = game.pHand.filter(c => c.selected);
        const res = game.attemptMeld(selected);
        
        if (res.success) {
            ui.render();
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
            ui.showAlert(res.msg || "Cannot discard");
        }
    },

    attemptJolly: () => {
        const res = game.attemptJollyHand();
        if(res.success) {
            ui.render();
            ui.updateStatus(res.msg || "Jolly Hand Active!");
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

App.init();
