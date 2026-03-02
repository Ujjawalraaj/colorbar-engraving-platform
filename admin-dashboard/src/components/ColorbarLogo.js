import React from 'react';
import colorbarLogo from '../assets/colorbar-logo.png';

const ColorbarLogo = ({ width = "220", white = false }) => (
  <img
    src={colorbarLogo}
    alt="Colorbar Logo"
    style={{ width: `${width}px`, height: 'auto', display: 'block' }}
    className={white ? "brightness-0 invert" : ""}
  />
);

export default ColorbarLogo;
