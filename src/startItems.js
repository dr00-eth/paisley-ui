const startOptions = [
    { value: 0, title: 'Listings', body: 'Create content centered around listing information' },
    { value: 1, title: 'Areas', body: 'Create content centered around area information' },
    { value: 5, title: 'Pre-Listings', body: 'Create content BEFORE you put on the MLS' },
    { value: 2, title: 'Coaching', body: 'Ask any Real Estate related question' },
    { value: 3, title: 'Follow Up', body: 'Create engagement follow up content' }
];

// startItems.js
export default function startItems({ context_id, onClick }) {
    return startOptions.map((option) => {
        return (
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
    });
}