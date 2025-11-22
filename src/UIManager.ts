import { GameState } from "./GameState";
import { ICard } from "./types";

export class UIManager {
    private game: GameState;
    // ... existing properties ...
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
        modalMsg: document.getElementById('modal-msg')!,
        alertModal: document.getElementById('alert-modal')!,
        alertTitle: document.getElementById('alert-title')!,
        alertMsg: document.getElementById('alert-msg')!
    };

    constructor(game: GameState) {
        this.game = game;
    }

    public render() {
        const { round, turnPoints, discardPile, pHand, cHand, melds, turnMelds, hasOpened, turn, bottomCard } = this.game;

        this.ui.score.innerText = `Rd: ${round} | Pts: ${turnPoints}`;

        // Bottom Card Logic
        if (bottomCard) {
             this.ui.stock.style.boxShadow = "2px 2px 0 #fff, 4px 4px 0 #000"; 
             
             let bEl = document.getElementById('bottom-card-display');
             if(!bEl) {
                 bEl = document.createElement('div');
                 bEl.id = 'bottom-card-display';
                 bEl.className = `card ${bottomCard.getColor()}`;
                 bEl.style.position = 'absolute';
                 bEl.style.top = '5px';
                 bEl.style.left = '5px';
                 bEl.style.zIndex = '0';
                 bEl.style.transform = 'rotate(5deg)';
                 bEl.innerHTML = this.renderCardInner(bottomCard);
                 this.ui.stock.parentElement?.appendChild(bEl);
                 this.ui.stock.style.zIndex = '5';
             }
        } else {
             const bEl = document.getElementById('bottom-card-display');
             if(bEl) bEl.remove();
        }

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
        
        // Jolly Hand
        let jhBtn = document.getElementById('btn-jolly');
        if (!jhBtn) {
            jhBtn = document.createElement('button');
            jhBtn.id = 'btn-jolly';
            jhBtn.className = 'win-btn';
            jhBtn.innerText = 'Take Jolly Hand';
            jhBtn.style.marginLeft = '10px';
            jhBtn.onclick = () => (window as any).game.attemptJolly();
            this.ui.btnDiscard.parentElement?.appendChild(jhBtn);
        }
        
        if (pHand.length === 12 && bottomCard && turn === 'human') {
            jhBtn.style.display = 'inline-block';
        } else {
            jhBtn.style.display = 'none';
        }

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

        const selectedCount = pHand.filter(c => c.selected).length;
        this.ui.btnMeld.disabled = selectedCount < 1; 
        this.ui.btnDiscard.disabled = selectedCount !== 1;
        
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

    public showAlert(msg: string, title: string = 'Alert') {
        this.ui.alertTitle.innerText = title;
        this.ui.alertMsg.innerText = msg;
        this.ui.alertModal.style.display = 'flex';
    }

    public closeAlert() {
        this.ui.alertModal.style.display = 'none';
    }

    private renderCardInner(c: ICard): string {
        if (c.isJoker) {
            const rep = c.representation;
            const topContent = rep ? `<span>${rep.rank}</span><span>${rep.suit}</span>` : `<span>🤡</span>`;
            const botContent = rep ? `<span>${rep.rank}</span><span>${rep.suit}</span>` : `<span>🤡</span>`;
            const style = rep ? 'color: gray; opacity: 0.7;' : '';

            return `
                <div class="card-top" style="${style}">${topContent}</div>
                <div class="card-center">🃏</div>
                <div class="card-bottom" style="${style}">${botContent}</div>
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

        if (selected.length === 1) {
            const res = this.game.attemptJokerSwap(meldIdx, selected[0].id);
            if (res.success) {
                this.render();
                return;
            }
        }

        const res = this.game.addToExistingMeld(meldIdx, selected);
        if (res.success) {
            if (res.winner) this.showWinModal(`${res.winner} Wins!`);
            this.render();
        } else {
            this.showAlert(res.msg || "Invalid Move");
        }
    }

    public animateDraw(card: ICard, source: 'stock' | 'discard', onComplete: () => void) {
        // ... (Unchanged)
        const sourceEl = source === 'stock' ? this.ui.stock : this.ui.discard;
        const targetEl = this.ui.pHand.querySelector(`[data-id="${card.id}"]`) as HTMLElement;
        if (!sourceEl || !targetEl) { onComplete(); return; }
        
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
