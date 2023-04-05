const startOptions = [
    { value: 0, title: 'Listing Focus', body: 'Create content centered around listing information' },
    { value: 1, title: 'Area Focus', body: 'Create content centered around area information' },
    { value: 5, title: 'Pre-Listing Focus', body: 'Create content BEFORE you put on the MLS' },
    { value: 2, title: 'Coaching Focus', body: 'Ask any Real Estate related question' },
    { value: 3, title: 'Follow Up Focus', body: 'Create engagement follow up content' }
];

// startItems.js
export default function startItems({ context_id, onClick }) {
    return (
      <>
        {startOptions.map((option, index) => {
          const box = (
            <div className="box" key={option.value}>
              <h3>{option.title}</h3>
              <div className="box-content">
                <p>{option.body}</p>
                {context_id !== option.value && (
                  <button value={option.value} onClick={onClick}>
                    Go There
                  </button>
                )}
              </div>
              {context_id === option.value && (
                <div className="active-banner">ACTIVE</div>
              )}
            </div>
          );
  
          if (index === 3) {
            return (
              <div key="centered-row" className="centered-row">
                {box}
                {startOptions[4] && (
                  <div className="box" key={startOptions[4].value}>
                    <h3>{startOptions[4].title}</h3>
                    <div className="box-content">
                      <p>{startOptions[4].body}</p>
                      {context_id !== startOptions[4].value && (
                        <button
                          value={startOptions[4].value}
                          onClick={onClick}
                        >
                          Go There
                        </button>
                      )}
                    </div>
                    {context_id === startOptions[4].value && (
                      <div className="active-banner">ACTIVE</div>
                    )}
                  </div>
                )}
              </div>
            );
          } else if (index !== 4) {
            return box;
          }

          return null;
        })}
      </>
    );
  }
  