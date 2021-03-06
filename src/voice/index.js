/**
 * This code integrates voice queires to Assistant with Slang.
 */

import Slang from 'slang-web-sdk';
import {replyValues} from './replyWith';
import {checkFunc, isNumeric} from './utils';
import ReactGA from 'react-ga';

function slangIntentToAction(props) {
  const {
    states,
    stateDistrictWiseData,
    stateTestData,
    districtZones,
    actions,
  } = props;

  const {
    onHighlightDistrict,
    onHighlightState,
    onDistrictFound,
    onStateFound,
    onCountryFound,
  } = actions;
  if (states && stateDistrictWiseData && stateTestData && districtZones) {
    // Show slang only if data exists
    Slang.ui.show();
  }
  let theDistricts = [];

  theDistricts = Object.keys(stateDistrictWiseData).reduce((acc, state) => {
    const dist = Object.keys(stateDistrictWiseData[state]['districtData'])
      .filter((i) => i.toLowerCase() !== 'unknown')
      .map((district) => ({
        name: district,
        state: state,
        ...stateDistrictWiseData[state]['districtData'][district],
      }));
    return [...acc, ...dist];
  }, []);

  let index;
  let district;
  let state;

  /* Data looks like this
  {
			"active": "7780",
			"confirmed": "9166",
			"deaths": "325",
			"deltaconfirmed": "714",
			"deltadeaths": "36",
			"deltarecovered": "89",
			"lastupdatedtime": "12/04/2020 21:00:24",
			"recovered": "1061",
			"state": "Total",
			"statecode": "TT"
		},
  */
  const numberFromState = (state, dataTypeQuery, newQuery) => {
    console.log('state = ', state, 'type = ', dataTypeQuery);
    if (!newQuery) {
      return {
        value: parseInt(state[dataTypeQuery]),
        lastupdatedtime: state.lastupdatedtime,
      };
    } else if (dataTypeQuery === 'active') {
      // since new active and new confirmed are the same
      return {
        value: parseInt(state['deltaconfirmed']),
        lastupdatedtime: state.lastupdatedtime,
      };
    } else {
      return {
        value: parseInt(state['delta' + dataTypeQuery]),
        lastupdatedtime: state.lastupdatedtime,
      };
    }
  };

  /*
    Data looks like this =
      {
        name: "Bengaluru"
        state: "Karnataka"
        active: 100
        confirmed: 100
        deceased: 0
        recovered: 0
        delta: {
          confirmed: 0,
          deceased: 0,
          recovered: 0
        }
      }
  */
  const numberFromDistrict = (district, dataTypeQuery, newQuery) => {
    console.log('distict = ');
    console.log(district);
    if (dataTypeQuery !== 'confirmed') {
      return null;
    } else {
      return parseInt(newQuery ? district.delta.confirmed : district.confirmed);
    }
  };

  // district: "Nicobars"
  // districtcode: "AN_Nicobars"
  // lastupdated: "01/05/2020"
  // source: "https://www.facebook.com/airnewsalerts/photos/a.262571017217636/1710062729135117/?type=3&theater"
  // state: "Andaman and Nicobar Islands"
  // statecode: "AN"
  // zone: "Green"

  const zoneFromDistrict = (districtQuery) => {
    console.log('distict = ');
    console.log(districtQuery);
    if (districtQuery) {
      const districtZone = districtZones.find((dist) => {
        // console.log(dist.district)
        return dist.district.trim().toLowerCase() === districtQuery;
      });
      if (districtZone) {
        return districtZone.zone;
      }
      return;
    }
    return null;
  };

  const numberTestedFromState = (stateName) => {
    const stateTested = stateTestData.find(
      (obj) =>
        obj.state.toLowerCase() === stateName.toLowerCase() &&
        obj.totaltested !== ''
    );

    return stateTested ? stateTested.totaltested : 0;
  };

  const allIndiaTested = () => {
    const testedIndia = states.reduce((acc, cur) => {
      let newStateTested = 0;
      if (cur.state !== 'Total')
        newStateTested = numberTestedFromState(cur.state);

      return acc + parseInt(newStateTested, 10);
    }, 0);
    return testedIndia;
  };
  // console.log(allIndiaTested());
  const replyWithStates = (intent) => {
    index = district = state = undefined;

    const stateQuery =
      intent.getEntity('state').isResolved &&
      intent.getEntity('state').value.trim().toLowerCase();
    const dataTypeQuery = intent.getEntity('data_type').isResolved
      ? intent.getEntity('data_type').value.trim().toLowerCase()
      : 'confirmed';
    const newQuery =
      intent.getEntity('new_type').isResolved &&
      intent.getEntity('new_type').value.trim().toLowerCase();

    const theStateData =
      stateQuery &&
      states.find((item, i) => {
        index = i;
        return item.state.trim().toLowerCase() === stateQuery;
      });
    const stateInfo = numberFromState(theStateData, dataTypeQuery, newQuery);
    const numberForState = stateInfo.value;
    const updatedState = stateInfo.lastupdatedtime;
    const numberTestedState = numberTestedFromState(stateQuery);
    console.log('dataTypeQuery = ' + dataTypeQuery);
    console.log('newQuery = ' + newQuery);
    console.log('stateQuery = ' + stateQuery);
    console.log('theStateData[state] = ' + numberForState);
    console.log('theStateData[state] = ' + numberTestedState);
    if (
      dataTypeQuery === 'tested' &&
      stateQuery &&
      theStateData &&
      isNumeric(numberTestedState)
    ) {
      if (isNumeric(index)) {
        if (checkFunc(onHighlightState)) onHighlightState(theStateData, index);
      }
      if (checkFunc(onStateFound))
        onStateFound({state: {...theStateData, tested: numberTestedState}});

      const prompt = replyValues({
        caseFor: 'replyWithStates',
        dataTypeQuery,
        stateQuery,
        newQuery: false,
        number: numberTestedState,
      });
      Slang.startConversation(prompt, true);
    } else if (dataTypeQuery && stateQuery && theStateData) {
      if (isNumeric(index)) {
        if (checkFunc(onHighlightState)) onHighlightState(theStateData, index);
      }
      if (checkFunc(onStateFound)) onStateFound({state: theStateData});

      // window.location.hash = '#MapStats';
      const prompt = replyValues({
        caseFor: 'replyWithStates',
        dataTypeQuery,
        stateQuery,
        newQuery,
        number: numberForState,
        lastUpdate: updatedState,
      });
      Slang.startConversation(prompt, true);
    } else {
      const prompt = replyValues({
        caseFor: 'noDataState',
      });

      Slang.startConversation(prompt, true);
    }

    // window.location.hash = '#_';
    index = district = state = undefined;
  };

  const replyWithNewDelhi = (intent) => {
    index = district = state = undefined;
    const districtQuery = 'new delhi';
    const dataTypeQuery =
      intent.getEntity('data_type').isResolved &&
      intent.getEntity('data_type').value.trim().toLowerCase();
    const newQuery = false;
    // const newQuery =
    //   intent.getEntity('new_type').isResolved &&
    //   intent.getEntity('new_type').value.trim().toLowerCase();

    if (dataTypeQuery && dataTypeQuery !== 'confirmed') {
      const prompt = replyValues({
        caseFor: 'noDataDistrict',
      });

      Slang.startConversation(prompt, true);
    } else {
      console.log('confirmed district');
      const theNumberDistrictConfirmed =
        districtQuery &&
        theDistricts.reduce((acc, item) => {
          if (item.name.trim().toLowerCase() === districtQuery) {
            index = item.state;
            district = item.name;
            state = item;
            return numberFromDistrict(item, 'confirmed', newQuery);
          }
          return acc;
        }, '');
      console.log(theNumberDistrictConfirmed);
      if (isNumeric(theNumberDistrictConfirmed)) {
        // window.location.hash = '#MapStats';
        index = states.findIndex((x) => x.state === index);
        if (district && state && isNumeric(index)) {
          console.log(district, state, index);
          if (checkFunc(onHighlightDistrict))
            onHighlightDistrict(district, state, index);

          if (checkFunc(onDistrictFound)) onDistrictFound({district, state});
        }
        const prompt = replyValues({
          caseFor: 'replyWithDistricts',
          districtQuery,
          newQuery,
          number: theNumberDistrictConfirmed,
        });

        Slang.startConversation(prompt, true);
      } else {
        const prompt = replyValues({
          caseFor: 'noDataState',
        });
        Slang.startConversation(prompt, true);
      }
    }
    // window.location.hash = '#_';
  };
  const replyWithDistricts = (intent) => {
    index = district = state = undefined;
    const districtQuery =
      intent.getEntity('district').isResolved &&
      intent.getEntity('district').value.trim().toLowerCase();
    const dataTypeQuery =
      intent.getEntity('data_type').isResolved &&
      intent.getEntity('data_type').value.trim().toLowerCase();
    const newQuery =
      intent.getEntity('new_type').isResolved &&
      intent.getEntity('new_type').value.trim().toLowerCase();

    if (dataTypeQuery && dataTypeQuery !== 'confirmed') {
      const prompt = replyValues({
        caseFor: 'noDataDistrict',
      });

      Slang.startConversation(prompt, true);
    } else {
      console.log('confirmed district', districtQuery);

      const theNumberDistrictConfirmed =
        districtQuery &&
        theDistricts.reduce((acc, item) => {
          if (item.name.trim().toLowerCase() === districtQuery) {
            index = item.state;
            district = item.name;
            state = item;
            return numberFromDistrict(item, 'confirmed', newQuery);
          }
          return acc;
        }, null);
      const distictZoneColor = zoneFromDistrict(districtQuery);
      console.log(distictZoneColor);
      let updatedState;

      if (newQuery) {
        console.log(index);
        const theStateData = states.find((item, i) => {
          return item.state.trim().toLowerCase() === index.trim().toLowerCase();
        });
        const stateInfo = numberFromState(theStateData, 'confirmed', newQuery);
        updatedState = stateInfo.lastupdatedtime;
      }
      console.log(theNumberDistrictConfirmed);
      if (isNumeric(theNumberDistrictConfirmed)) {
        // window.location.hash = '#MapStats';
        index = states.findIndex((x) => x.state === index);

        if (district && state && isNumeric(index)) {
          console.log(district, state, index);
          if (checkFunc(onHighlightDistrict))
            onHighlightDistrict(district, state, index);

          if (checkFunc(onDistrictFound)) onDistrictFound({district, state});
        }

        const prompt = replyValues({
          caseFor: 'replyWithDistricts',
          districtQuery,
          newQuery,
          number: theNumberDistrictConfirmed,
          lastUpdate: updatedState,
          distictZoneColor,
        });

        Slang.startConversation(prompt, true);
      } else {
        const prompt = replyValues({
          caseFor: 'noDataState',
        });
        Slang.startConversation(prompt, true);
      }
    }
    // window.location.hash = '#_';
  };

  const replyWithCountry = (intent) => {
    index = district = state = undefined;

    let stateQuery = 'total';
    const countryQuery = intent.getEntity('country').isResolved
      ? intent.getEntity('country').value.trim()
      : 'India';
    const orderQuery =
      intent.getEntity('order').isResolved &&
      intent.getEntity('order').value.trim().toLowerCase();
    const dataTypeQuery = intent.getEntity('data_type').isResolved
      ? intent.getEntity('data_type').value.trim().toLowerCase()
      : 'confirmed';
    const newQuery =
      intent.getEntity('new_type').isResolved &&
      intent.getEntity('new_type').value.trim().toLowerCase();

    console.log('countryQuery = ' + countryQuery);
    if (countryQuery !== 'India') {
      Slang.startConversation('We curently support data only for India', true);
    } else if (orderQuery) {
      console.log('orderQuery = ' + orderQuery);
      console.log('dataTypeQuery = ' + dataTypeQuery);
      let highestState = states[1].state;
      let highestValue = numberFromState(states[1], dataTypeQuery, newQuery)
        .value;
      let lowestState = states[1].state;
      let lowestValue = numberFromState(states[1], dataTypeQuery, newQuery)
        .value;

      states.forEach((item, i) => {
        if (item.state === 'Total') return;

        if (parseInt(item[dataTypeQuery]) > highestValue) {
          highestValue = numberFromState(item, dataTypeQuery, newQuery).value;
          highestState = item.state.trim().toLowerCase();
        }
        if (parseInt(item[dataTypeQuery]) < lowestValue) {
          lowestValue = numberFromState(item, dataTypeQuery, newQuery).value;
          lowestState = item.state.trim().toLowerCase();
        }
      });

      let numberQuery;

      if (orderQuery === 'highest') {
        stateQuery = highestState;
        numberQuery = highestValue;
      } else {
        stateQuery = lowestState;
        numberQuery = lowestValue;
      }

      // props.onHighlightState(theNumber, index);
      // window.location.hash = '#MapStats';
      if (dataTypeQuery && stateQuery && checkFunc(onCountryFound)) {
        onCountryFound({country: stateQuery});
      }
      const prompt = replyValues({
        caseFor: 'replyWithOrder',
        dataTypeQuery,
        stateQuery,
        orderQuery: orderQuery,
        newQuery,
        number: numberQuery,
      });
      Slang.startConversation(prompt, true);
    } else {
      console.log('India query = ' + dataTypeQuery);
      const theNumber =
        stateQuery &&
        states.find((item, i) => {
          index = i;
          return item.state.trim().toLowerCase() === stateQuery;
        });
      const numberForIndia = numberFromState(theNumber, dataTypeQuery, newQuery)
        .value;
      const numberIndiaTested = allIndiaTested();
      console.log('dataTypeQuery = ' + dataTypeQuery);
      console.log('stateQuery = ' + stateQuery);
      console.log(theNumber);
      console.log('theNumber[state] = ' + numberForIndia);

      if (
        dataTypeQuery === 'tested' &&
        stateQuery &&
        isNumeric(numberIndiaTested)
      ) {
        // window.location.hash = '#MapStats';
        if (checkFunc(onCountryFound)) {
          onCountryFound({country: stateQuery});
        }
        const prompt = replyValues({
          caseFor: 'replyWithStates',
          dataTypeQuery,
          stateQuery: 'India',
          newQuery,
          number: numberIndiaTested,
        });
        Slang.startConversation(prompt, true);
      } else if (
        dataTypeQuery &&
        stateQuery &&
        theNumber &&
        isNumeric(numberForIndia)
      ) {
        console.log(theNumber, index);

        if (theNumber && isNumeric(index)) {
          console.log(theNumber, index);

          if (checkFunc(onHighlightState)) {
            onHighlightState(theNumber, index);
          }
        }
        if (checkFunc(onCountryFound)) onCountryFound({country: theNumber});

        // window.location.hash = '#MapStats';
        const prompt = replyValues({
          caseFor: 'replyWithStates',
          dataTypeQuery,
          stateQuery: 'India',
          newQuery,
          number: numberForIndia,
        });
        Slang.startConversation(prompt, true);
      } else {
        const prompt = replyValues({
          caseFor: 'noDataState',
        });

        Slang.startConversation(prompt, true);
      }
    }

    // window.location.hash = '#_';
    index = district = state = undefined;
  };

  try {
    Slang.setOnUtteranceDetected((string) => {
      console.log('utterance - ' + string);
      ReactGA.event({
        category: 'Slang events',
        action: 'trigger click',
      });
    });
    Slang.setIntentActionHandler((intent) => {
      console.log(intent);
      const isNewDelhi = () => {
        const utt = intent.userUtterance.toLowerCase();
        console.log(utt.match(/new delhi/));
        return utt.match(/new delhi/);
      };

      if (intent.name === 'get_status') {
        if (intent.getEntity('country').isResolved) {
          replyWithCountry(intent);
          return true;
        }
        if (intent.getEntity('state').isResolved) {
          replyWithStates(intent);
          return true;
        }
        if (intent.getEntity('district').isResolved) {
          replyWithDistricts(intent);
          return true;
        }
        if (isNewDelhi()) {
          replyWithNewDelhi(intent);
          return true;
        } else if (intent.getEntity('data_type').isResolved) {
          replyWithCountry(intent);
          return true;
        }
        const prompt = replyValues({
          caseFor: 'noDataState',
        });

        Slang.startConversation(prompt, true);
        return false;
      }
      return false;
    });
  } catch (error) {
    console.log(error);
  }

  return null;
}

export default slangIntentToAction;
