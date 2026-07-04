import React from 'react';
import './CosmicSwitch.css';

const Switch = ({ checked, onChange, disabled = false }) => {
  const particles = [
    { angle: '30deg', left: '20%', delay: '0s' },
    { angle: '60deg', left: '40%', delay: '0.2s' },
    { angle: '90deg', left: '60%', delay: '0.4s' },
    { angle: '120deg', left: '80%', delay: '0.6s' },
    { angle: '150deg', left: '30%', delay: '0.8s' },
    { angle: '180deg', left: '70%', delay: '1s' },
  ];

  return (
    <label className={`cosmic-toggle ${disabled ? 'disabled' : ''}`}>
      <input
        type="checkbox"
        className="toggle"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <div className="slider">
        <div className="cosmos"></div>
        <div className="energy-line"></div>
        <div className="energy-line"></div>
        <div className="energy-line"></div>
        <div className="toggle-orb">
          <div className="inner-orb"></div>
          <div className="ring"></div>
        </div>
        <div className="particles">
          {particles.map((particle, idx) => (
            <div
              key={idx}
              className="particle"
              style={{
                '--angle': particle.angle,
                left: particle.left,
                animationDelay: particle.delay,
              }}
            />
          ))}
        </div>
      </div>
    </label>
  );
};

export default Switch;