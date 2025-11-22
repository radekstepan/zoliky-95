import { GameState } from "./GameState";
import { ICard } from "./types";

export class UIManager {
    private game: GameState;
    
    private ui = {
        stock: document.getElementById('stock-pile')!,
        discard: document.getElementById('discard-pile')!,
        pHand: document.getElementById('player-hand')!,
        cHand: document.getElementById('cpu-hand')!,
        table: document.getElementById('table-zone')!,
        status: document.getElementById('status-text')!,
        score: document.getElementById('score-text')!,
        btnMeld: document.getElementById('btn-meld') as HTMLButtonElement,
        btnCancel: document.getElementById('btn-cancel') as HTMLButtonElement,
        btnDiscard: document.getElementById('btn-discard') as HTMLButtonElement,
        modal: document.getElementById('modal')!,
        modalMsg: document.getElementById('modal-msg')!
    };

    constructor(game: GameState) {
        this.game = game;
    }

    public render() {
        const { round, turnPoints, discardPile, pHand, cHand, melds, turnMelds, hasOpened, turn } = this.game;

        // Stats
        this.ui.score.innerText = `Rd: ${round} | Pts: ${turnPoints}/36`;

        // Discard Pile
        if (discardPile.length > 0) {
            const top = discardPile[discardPile.length - 1];
            this.ui.discard.innerHTML = this.renderCardInner(top);
            this.ui.discard.className = `card ${top.getColor()}`;
            this.ui.discard.style.opacity = "1";
        } else {
            this.ui.discard.innerHTML = "";
            this.ui.discard.className = "card";
            this.ui.discard.style.opacity = "0.5";
        }

        // Player Hand
        this.ui.pHand.innerHTML = '';
        pHand.forEach(c => {
            const el = document.createElement('div');
            el.className = `card ${c.getColor()} ${c.selected ? 'selected' : ''}`;
            el.dataset.id = c.id.toString(); 
            el.innerHTML = this.renderCardInner(c);
            el.onclick = () => this.handleCardClick(c);
            this.ui.pHand.appendChild(el);
        });

        // CPU Hand
        this.ui.cHand.innerHTML = '';
        cHand.forEach(() => {
            const el = document.createElement('div');
            el.className = `card card-back`; 
            this.ui.cHand.appendChild(el);
        });

        // Table
        this.ui.table.innerHTML = '';
        melds.forEach((meld, idx) => {
            const grp = document.createElement('div');
            // Check if this meld is "pending" (in current turn, not yet opened)
            const isPending = turnMelds.includes(idx) && !hasOpened.human && turn === 'human';
            
            grp.className = `meld-group ${isPending ? 'pending' : ''}`;
            grp.onclick = () => this.handleMeldClick(idx);
            
            meld.forEach(c => {
                const el = document.createElement('div');
                el.className = `card ${c.getColor()}`;
                el.innerHTML = this.renderCardInner(c);
                grp.appendChild(el);
            });
            this.ui.table.appendChild(grp);
        });

        // Buttons State
        const selectedCount = pHand.filter(c => c.selected).length;
        this.ui.btnMeld.disabled = selectedCount === 0;
        this.ui.btnDiscard.disabled = selectedCount !== 1;
        
        // Cancel Button Visibility
        if (turnMelds.length > 0 && !hasOpened.human) {
            this.ui.btnCancel.style.display = 'block';
        } else {
            this.ui.btnCancel.style.display = 'none';
        }
    }

    public updateStatus(msg: string) {
        this.ui.status.innerText = msg;
    }

    public showWinModal(msg: string) {
        this.ui.modalMsg.innerText = msg;
        this.ui.modal.style.display = 'flex';
    }

    public closeWinModal() {
        this.ui.modal.style.display = 'none';
    }

    // --- Internal DOM Helpers ---

    private renderCardInner(c: ICard): string {
        if (c.isJoker) {
            return `
                <div class="card-top"><span>🤡</span></div>
                <div class="card-center">🃏</div>
                <div class="card-bottom"><span>🤡</span></div>
            `;
        }
        return `
            <div class="card-top"><span>${c.rank}</span><span>${c.suit}</span></div>
            <div class="card-center">${c.suit}</div>
            <div class="card-bottom"><span>${c.rank}</span><span>${c.suit}</span></div>
        `;
    }

    private handleCardClick(card: ICard) {
        if (this.game.turn !== 'human' || this.game.phase !== 'action') return;
        card.selected = !card.selected;
        this.render();
    }

    private handleMeldClick(meldIdx: number) {
        const selected = this.game.pHand.filter(c => c.selected);
        if (selected.length === 0) return;

        const res = this.game.addToExistingMeld(meldIdx, selected);
        if (res.success) {
            if (res.winner) {
                this.showWinModal(`${res.winner} Wins!`);
            }
            this.render();
        } else {
            alert(res.msg);
        }
    }

    // Animation for drawing
    public animateDraw(card: ICard, source: 'stock' | 'discard', onComplete: () => void) {
        const sourceEl = source === 'stock' ? this.ui.stock : this.ui.discard;
        const targetEl = this.ui.pHand.querySelector(`[data-id="${card.id}"]`) as HTMLElement;

        if (!sourceEl || !targetEl) {
            onComplete();
            return;
        }

        // Temporarily hide the real card in hand
        targetEl.style.opacity = '0';

        const flyer = document.createElement('div');
        flyer.className = `card ${card.getColor()} flying-card`;
        flyer.innerHTML = this.renderCardInner(card);

        const sRect = sourceEl.getBoundingClientRect();
        flyer.style.left = sRect.left + 'px';
        flyer.style.top = sRect.top + 'px';
        flyer.style.width = sRect.width + 'px';
        flyer.style.height = sRect.height + 'px';

        document.body.appendChild(flyer);
        // Force reflow
        flyer.offsetHeight;

        const tRect = targetEl.getBoundingClientRect();
        flyer.style.left = tRect.left + 'px';
        flyer.style.top = tRect.top + 'px';
        flyer.style.transform = 'scale(1.0)';

        setTimeout(() => {
            document.body.removeChild(flyer);
            targetEl.style.opacity = '1';
            onComplete();
        }, 500);
    }
}
