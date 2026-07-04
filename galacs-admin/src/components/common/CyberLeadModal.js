import React from 'react';
import ReactDOM from 'react-dom';
import styled from 'styled-components';

const CyberLeadModal = ({ isOpen, lead, onClose }) => {
  if (!isOpen || !lead) return null;

  return ReactDOM.createPortal(
    <ModalOverlay onClick={onClose}>
      <ModalContainer onClick={(e) => e.stopPropagation()}>
        <StyledWrapper>
          <div className="container noselect">
            <div className="canvas">
              {[...Array(25)].map((_, i) => (
                <div key={i} className={`tracker tr-${i + 1}`} />
              ))}
              <div id="card">
                <div className="card-content">
                  <div className="card-glare" />
                  <div className="cyber-lines">
                    <span /><span /><span /><span />
                  </div>
                  <p id="prompt">FICHE PROSPECT</p>
                  <div className="title">
                    {lead.prospect}<br />
                    <span className="ref">{lead.ref}</span>
                  </div>
                  <div className="info-grid">
                    <div><strong>Bien</strong><br />{lead.bien}</div>
                    <div><strong>Budget</strong><br />{lead.budget.toLocaleString()} €</div>
                    <div><strong>Score IA</strong><br />{lead.score}%</div>
                    <div><strong>Statut</strong><br />{lead.statut}</div>
                    <div><strong>Agent</strong><br />{lead.agent}</div>
                  </div>
                  <div className="glowing-elements">
                    <div className="glow-1" />
                    <div className="glow-2" />
                    <div className="glow-3" />
                  </div>
                  <div className="card-particles">
                    <span /><span /><span /><span /><span /><span />
                  </div>
                  <div className="corner-elements">
                    <span /><span /><span /><span />
                  </div>
                  <div className="scan-line" />
                </div>
              </div>
            </div>
          </div>
        </StyledWrapper>
        <CloseButton onClick={onClose}>✕</CloseButton>
      </ModalContainer>
    </ModalOverlay>,
    document.body
  );
};

export default CyberLeadModal;
const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(6, 8, 22, 0.92);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContainer = styled.div`
  position: relative;
  transform: scale(1.2);
`;

const CloseButton = styled.button`
  position: absolute;
  top: -30px;
  right: -30px;
  background: #ef4444;
  border: none;
  color: white;
  font-size: 20px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 1010;
  &:hover {
    background: #ff6b81;
    transform: scale(1.05);
  }
`;

const StyledWrapper = styled.div`
  /* Use your CSS variables for colors – fallback values */
  --bg: #0B1120;
  --card: #111827;
  --card2: #1F2937;
  --border2: #374151;
  --border-n: #374151;
  --muted: #9CA3AF;
  --gold: #F59E0B;
  --gold3: rgba(245, 158, 11, 0.3);
  --accent: #F59E0B;
  --white: #F3F4F6;
  --red: #EF4444;

  .container {
    position: relative;
    width: 360px;
    height: 460px;
    transition: 200ms;
  }

  .container:active {
    width: 340px;
    height: 440px;
  }

  #card {
    position: absolute;
    inset: 0;
    z-index: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 20px;
    transition: 700ms;
    background: linear-gradient(145deg, var(--card), var(--card2));
    border: 1px solid var(--border2);
    overflow: hidden;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(0, 0, 0, 0.3);
  }

  .card-content {
    position: relative;
    width: 100%;
    height: 100%;
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  #prompt {
    position: absolute;
    top: 15px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 20;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 2px;
    color: var(--muted);
    text-shadow: 0 0 8px rgba(245, 158, 11, 0.3);
  }

  .title {
    opacity: 1;
    margin-top: 45px;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: 2px;
    text-align: center;
    background: linear-gradient(135deg, var(--gold), var(--accent));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 0 12px rgba(245, 158, 11, 0.4));
  }

  .title .ref {
    font-size: 13px;
    background: none;
    -webkit-text-fill-color: var(--muted);
    display: block;
    margin-top: 6px;
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    text-align: center;
    color: var(--white);
    font-size: 12px;
    margin: 20px 0;
    background: rgba(0, 0, 0, 0.4);
    padding: 14px;
    border-radius: 16px;
    backdrop-filter: blur(4px);
  }

  .info-grid div {
    background: rgba(255, 255, 255, 0.04);
    padding: 8px;
    border-radius: 10px;
    border: 1px solid var(--border-n);
  }

  .info-grid strong {
    color: var(--gold);
    display: block;
    margin-bottom: 5px;
    font-size: 11px;
    text-transform: uppercase;
  }

  .glow-1, .glow-2, .glow-3 {
    position: absolute;
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: radial-gradient(circle at center, var(--gold3) 0%, rgba(245, 158, 11, 0) 70%);
    filter: blur(15px);
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  .glow-1 { top: -20px; left: -20px; }
  .glow-2 { top: 50%; right: -30px; transform: translateY(-50%); }
  .glow-3 { bottom: -20px; left: 30%; }

  .card-particles span {
    position: absolute;
    width: 3px;
    height: 3px;
    background: var(--gold);
    border-radius: 50%;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .card-particles span:nth-child(1) { --x: 1; --y: -1; top: 40%; left: 20%; }
  .card-particles span:nth-child(2) { --x: -1; --y: -1; top: 60%; right: 20%; }
  .card-particles span:nth-child(3) { --x: 0.5; --y: 1; top: 20%; left: 40%; }
  .card-particles span:nth-child(4) { --x: -0.5; --y: 1; top: 80%; right: 40%; }
  .card-particles span:nth-child(5) { --x: 1; --y: 0.5; top: 30%; left: 60%; }
  .card-particles span:nth-child(6) { --x: -1; --y: 0.5; top: 70%; right: 60%; }

  .canvas {
    perspective: 800px;
    inset: 0;
    z-index: 200;
    position: absolute;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    grid-template-rows: repeat(5, 1fr);
    gap: 0px;
  }
  .tracker {
    position: relative;
    z-index: 200;
    width: 100%;
    height: 100%;
  }
  .tracker:hover {
    cursor: pointer;
  }
  .tracker:hover ~ #card #prompt {
    opacity: 0;
  }
  .tracker:hover ~ #card {
    filter: brightness(1.05);
  }

  /* Generate rotate rules for 25 trackers (example for first two) */
  .tr-1:hover ~ #card { transform: rotateX(20deg) rotateY(-10deg); }
  .tr-2:hover ~ #card { transform: rotateX(20deg) rotateY(-5deg); }
  .tr-3:hover ~ #card { transform: rotateX(20deg) rotateY(0deg); }
  .tr-4:hover ~ #card { transform: rotateX(20deg) rotateY(5deg); }
  .tr-5:hover ~ #card { transform: rotateX(20deg) rotateY(10deg); }
  .tr-6:hover ~ #card { transform: rotateX(10deg) rotateY(-10deg); }
  .tr-7:hover ~ #card { transform: rotateX(10deg) rotateY(-5deg); }
  .tr-8:hover ~ #card { transform: rotateX(10deg) rotateY(0deg); }
  .tr-9:hover ~ #card { transform: rotateX(10deg) rotateY(5deg); }
  .tr-10:hover ~ #card { transform: rotateX(10deg) rotateY(10deg); }
  .tr-11:hover ~ #card { transform: rotateX(0deg) rotateY(-10deg); }
  .tr-12:hover ~ #card { transform: rotateX(0deg) rotateY(-5deg); }
  .tr-13:hover ~ #card { transform: rotateX(0deg) rotateY(0deg); }
  .tr-14:hover ~ #card { transform: rotateX(0deg) rotateY(5deg); }
  .tr-15:hover ~ #card { transform: rotateX(0deg) rotateY(10deg); }
  .tr-16:hover ~ #card { transform: rotateX(-10deg) rotateY(-10deg); }
  .tr-17:hover ~ #card { transform: rotateX(-10deg) rotateY(-5deg); }
  .tr-18:hover ~ #card { transform: rotateX(-10deg) rotateY(0deg); }
  .tr-19:hover ~ #card { transform: rotateX(-10deg) rotateY(5deg); }
  .tr-20:hover ~ #card { transform: rotateX(-10deg) rotateY(10deg); }
  .tr-21:hover ~ #card { transform: rotateX(-20deg) rotateY(-10deg); }
  .tr-22:hover ~ #card { transform: rotateX(-20deg) rotateY(-5deg); }
  .tr-23:hover ~ #card { transform: rotateX(-20deg) rotateY(0deg); }
  .tr-24:hover ~ #card { transform: rotateX(-20deg) rotateY(5deg); }
  .tr-25:hover ~ #card { transform: rotateX(-20deg) rotateY(10deg); }

  .cyber-lines span {
    position: absolute;
    background: linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.3), transparent);
  }
  .cyber-lines span:nth-child(1) { top: 20%; left: 0; width: 100%; height: 1px; animation: lineGrow 3s linear infinite; }
  .cyber-lines span:nth-child(2) { top: 40%; right: 0; width: 100%; height: 1px; animation: lineGrow 3s linear infinite 1s; }
  .cyber-lines span:nth-child(3) { top: 60%; left: 0; width: 100%; height: 1px; animation: lineGrow 3s linear infinite 2s; }
  .cyber-lines span:nth-child(4) { top: 80%; right: 0; width: 100%; height: 1px; animation: lineGrow 3s linear infinite 1.5s; }

  @keyframes lineGrow {
    0% { transform: scaleX(0); opacity: 0; }
    50% { transform: scaleX(1); opacity: 1; }
    100% { transform: scaleX(0); opacity: 0; }
  }

  .corner-elements span {
    position: absolute;
    width: 15px;
    height: 15px;
    border: 2px solid var(--border2);
  }
  .corner-elements span:nth-child(1) { top: 10px; left: 10px; border-right: 0; border-bottom: 0; }
  .corner-elements span:nth-child(2) { top: 10px; right: 10px; border-left: 0; border-bottom: 0; }
  .corner-elements span:nth-child(3) { bottom: 10px; left: 10px; border-right: 0; border-top: 0; }
  .corner-elements span:nth-child(4) { bottom: 10px; right: 10px; border-left: 0; border-top: 0; }

  .scan-line {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent, rgba(245, 158, 11, 0.15), transparent);
    transform: translateY(-100%);
    animation: scanMove 2s linear infinite;
  }
  @keyframes scanMove {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100%); }
  }

  .card-glare {
    position: absolute;
    inset: 0;
    background: linear-gradient(125deg, rgba(255,255,255,0) 0%, rgba(245,158,11,0.05) 45%, rgba(245,158,11,0.1) 50%, rgba(245,158,11,0.05) 55%, rgba(255,255,255,0) 100%);
    opacity: 0;
    transition: opacity 300ms;
  }
  #card:hover .card-glare {
    opacity: 1;
  }
  #card:hover .corner-elements span {
    border-color: var(--gold);
    box-shadow: 0 0 8px var(--gold3);
  }
`;