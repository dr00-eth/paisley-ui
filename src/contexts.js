const contextOptions = [
    { value: 0, label: 'Listing Focused' },
    { value: 1, label: 'Area Focused' },
    { value: 5, label: 'Pre-Listing Focused' },
    { value: 2, label: 'RE Coaching' },
    { value: 3, label: 'Follow Up' },
    { value: 4, label: 'ChatGPT' }
];

export const contextItems = contextOptions.map((option, index) => {
    return (
        <option key={index} value={option.value}>
            {option.label}
        </option>
    );
});
