import Autosuggest from 'react-autosuggest';
import { getUserAreas } from './utils';
import { showLoading, hideLoading } from './helpers';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSync } from "@fortawesome/free-solid-svg-icons";
import { onSuggestionsClearRequested, onSuggestionsFetchRequested, getSuggestionValue, renderSuggestion, autoSuggestOnChange } from './utils'
const startOptions = [
  { value: 0, title: 'Listing Focus', body: 'Create content centered around listing information' },
  { value: 1, title: 'Area Focus', body: 'Create content centered around area information' },
  { value: 5, title: 'Pre-Listing Focus', body: 'Create content BEFORE you put on the MLS' },
  { value: 2, title: 'Coaching Focus', body: 'Ask any Real Estate related question' },
  { value: 3, title: 'Follow Up Focus', body: 'Create engagement follow up content' }
];

// startItems.js
export default function startItems({ context_id, context, onClick, listingChange, listingAreaChange, areaChange }) {
  return (
    <>
      {startOptions.map((option, index) => {
        const box = (
          <div className={`box ${context_id === option.value ? 'active' : ''}`} key={option.value}>
            <h3>{option.title}</h3>
            <div className="box-content">
              <p>{option.body}</p>
              {context_id === option.value && context_id === 0 && (
                <div className="listingSelectBox">
                  <select ref={context.listingSelectRef} value={`${context.state.selectedListingMlsID}_${context.state.selectedListingMlsNumber}`} className='Content-dropdown' disabled={context.state.isUserListingSelectDisabled || context.state.incomingChatInProgress} onChange={listingChange}>
                    {context.state.listings.length === 0 && <option value="">No Listings Available</option>}
                    {context.state.listings.length > 0 && <option value="">Select Listing</option>}
                    {context.state.listings.length > 0 && context.state.listings.map((listing, index) => (
                      <option key={index} value={`${listing.mlsID}_${listing.mlsNumber}`}>
                        {listing.mlsNumber} - {listing.streetNumber} {listing.streetName} {listing.unitNumber} ({listing.statusType})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {context_id === option.value && context_id === 0 && context.state.listingAreas.length > 0 && (
                <select value={context.state.selectedListingAreaId} className='Content-dropdown' disabled={context.state.isUserAreaSelectDisabled || context.state.incomingChatInProgress} onChange={listingAreaChange}>
                  <option value="">Select Area</option>
                  {context.state.listingAreas.map((area) => (
                    <option key={area.areaId} value={area.areaId}>
                      {area.areaName} ({area.areaType}) - {`${area.areaApnCount} properties`}
                    </option>
                  ))}
                </select>
              )}
              {context_id === option.value && context_id === 1 && context.state.agentProfileUserId && (
                <div className='areaSelectBox'>
                  <select value={context.state.selectedAreaId} className='Content-dropdown' disabled={context.state.isUserAreaSelectDisabled || context.state.incomingChatInProgress} onChange={areaChange}>
                    {context.state.areas.length === 0 && <option value="">No Areas Available</option>}
                    {context.state.areas.length > 0 && <option value="">-- Select Area --</option>}
                    {context.state.areas.length > 0 && context.state.areas.map((area) => (
                      <option key={area.areaId} value={area.areaId}>
                        {area.areaName} ({area.areaType}) {area.hasBeenOptimized ? '*' : ''}
                      </option>
                    )
                    )}
                  </select>
                  <button className='refresh-icon' onClick={async () => {
                    showLoading(context);
                    await getUserAreas(context, true);
                    hideLoading(context);
                  }}><FontAwesomeIcon icon={faSync} /></button>
                </div>
              )}
              {context_id === option.value && context_id === 5 && context.state.agentProfileUserId && (
                <div className='addressSearchBox'>
                  <Autosuggest
                    suggestions={context.state.addressSuggestions}
                    onSuggestionsFetchRequested={(value) => onSuggestionsFetchRequested(value, context)}
                    onSuggestionsClearRequested={() => onSuggestionsClearRequested(context)}
                    getSuggestionValue={getSuggestionValue}
                    renderSuggestion={(value) => renderSuggestion(value, context)}
                    inputProps={{
                      disabled: context.state.isAddressSearchDisabled,
                      placeholder: 'Enter an address',
                      value: context.state.addressSearchString,
                      onChange: (event, { newValue }) => autoSuggestOnChange(event, { newValue }, context),
                    }}
                  />
                  {context.state.listingAreas.length > 0 && (
                    <select value={context.state.selectedListingAreaId} className='Content-dropdown' disabled={context.state.isUserAreaSelectDisabled || context.state.incomingChatInProgress} onChange={listingAreaChange}>
                      <option value="">-- Select Area --</option>
                      {context.state.listingAreas.map((area) => (
                        <option key={area.areaId} value={area.areaId}>
                          {area.areaName} ({area.areaType}) - {`${area.areaApnCount} properties`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              {context_id !== option.value && (
                <button value={option.value} onClick={onClick}>
                  Go There
                </button>
              )}
            </div>
            {context_id === option.value && (
              (() => {
                if (context_id === 0 && !context.state.selectedListingMlsNumber) {
                  return <div className="active-banner">ACTIVE - Select Listing</div>
                } else if (context_id === 0 && context.state.selectedListingMlsNumber) {
                  return <div className="active-banner">ACTIVE - Start Typing!</div>
                } else if (context_id === 1 && !context.state.selectedAreaId) {
                  return <div className="active-banner">ACTIVE - Select Area</div>
                } else if (context_id === 1 && context.state.selectedListingAreaId) {
                  return <div className="active-banner">ACTIVE - Start Typing!</div>
                } else if (context_id === 5 && context.state.selectedProperty.length === 0) {
                  return <div className="active-banner">ACTIVE - Search for Address</div>
                } else if (context_id === 5 && context.state.addressSearchString && context.state.listingAreas.length > 0 && context.state.selectedListingAreaId === 0) {
                  return <div className="active-banner">ACTIVE - Select Area (Optional)</div>
                } else {
                  return <div className="active-banner">ACTIVE - Start Typing!</div>
                }
              })()
            )}
          </div>
        );

        if (index === 3) {
          return (
            <div key="centered-row" className="centered-row">
              {box}
              {startOptions[4] && (
                <div className={`box ${context_id === startOptions[4].value ? 'active' : ''}`} key={startOptions[4].value}>
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
                    (() => {
                      return <div className="active-banner">ACTIVE - Start Typing!</div>
                    })()
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
