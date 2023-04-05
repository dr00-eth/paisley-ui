// ChatGPTBox.js
import React from 'react';

const ChatGPTBox = ({ active, onClick }) => (
  <div className="box" key="4">
    <h3>General Intelligence</h3>
    <div className="box-content">
      <p>Ask for anything you want about any topic. This model has no particular focus and is not trained on anything specifically related to you or the Real Estate market.</p>
      {!active && (<button value="4" onClick={onClick}>
        Go There
      </button>)}
    </div>
    {active && <div className="active-banner">ACTIVE</div>}
  </div>
);

export default ChatGPTBox;
