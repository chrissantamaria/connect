import React, { Component } from 'react';
import { connect } from 'react-redux';
import Obstruction from 'obstruction';
import fecha from 'fecha';
import * as Sentry from '@sentry/react';
import { withStyles, Typography, IconButton, Button, CircularProgress } from '@material-ui/core';
import KeyboardBackspaceIcon from '@material-ui/icons/KeyboardBackspace';
import ErrorIcon from '@material-ui/icons/ErrorOutline';
import WarningIcon from '@material-ui/icons/Warning';

import { billing as Billing } from '@commaai/comma-api';

import { deviceTypePretty } from '../../utils';
import { fetchSimInfo } from './util';
import PrimeChecklist from './PrimeChecklist';
import ResizeHandler from '../ResizeHandler';
import Colors from '../../colors';
import { primeNav } from '../../actions';

const styles = (theme) => ({
  primeBox: {
    display: 'flex',
    flexDirection: 'column',
  },
  primeContainer: {
    borderBottom: `1px solid ${Colors.white10}`,
    color: '#fff',
  },
  primeBlock: {
    marginTop: 10,
  },
  moreInfoContainer: {
    '& p': { display: 'inline' },
    '& button': { display: 'inline', marginLeft: '15px' },
  },
  introLine: {
    lineHeight: '23px',
  },
  checkList: {
    marginLeft: 10,
    marginBottom: 10,
  },
  checkListItem: {
    padding: '5px 0',
    '& svg': { margin: 0 },
  },
  deviceId: {
    color: '#525E66',
  },
  leftMargin: {
    marginLeft: 10,
  },
  deviceBlock: {
    marginLeft: 10,
    '& aside': { display: 'inline', marginRight: 5, },
    '& span': { display: 'inline', },
  },
  overviewBlock: {
    marginTop: 20,
  },
  overviewBlockError: {
    marginTop: 15,
    padding: 10,
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
    '& p': { display: 'inline-block', marginLeft: 10 },
  },
  overviewBlockWarning: {
    marginTop: 15,
    padding: 10,
    display: 'flex',
    alignItems: 'center',
    backgroundColor: Colors.orange200,
    '& p': { display: 'inline-block', marginLeft: 10 },
  },
  overviewBlockLoading: {
    marginTop: 15,
    padding: 10,
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    '& p': { display: 'inline-block', marginLeft: 10 },
  },
  chargeText: {
    marginBottom: 10,
  },
  buttons: {
    marginTop: 10,
    background: Colors.white,
    borderRadius: 18,
    color: '#404B4F',
    textTransform: 'none',
    width: 200,
    '&:hover': {
      backgroundColor: Colors.white70,
      color: '#404B4F',
    },
    '&:disabled': {
      backgroundColor: Colors.white70,
      color: '#404B4F',
    },
    '&:disabled:hover': {
      backgroundColor: Colors.white70,
      color: '#404B4F',
    }
  },
});

class PrimeCheckout extends Component {
  constructor(props) {
    super(props);

    this.state = {
      error: null,
      simInfo: null,
      simValid: null,
      simInfoLoading: false,
      loadingCheckout: false,
      windowWidth: window.innerWidth,
    };

    this.fetchSimDetails = this.fetchSimDetails.bind(this);
    this.fetchSimValid = this.fetchSimValid.bind(this);
    this.gotoCheckout = this.gotoCheckout.bind(this);
  }

  componentDidMount() {
    this.setState({ simInfoLoading: true });
    this.fetchSimDetails(true);
    this.componentDidUpdate({});
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.stripe_cancelled && this.props.stripe_cancelled) {
      this.setState({ error: 'checkout cancelled' });
    }
  }

  async fetchSimDetails(retry) {
    try {
      const simInfo = await fetchSimInfo(this.props.dongleId);
      this.setState({ simInfo });
      this.fetchSimValid();
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        if (retry) {
          console.log('Failed to fetch sim info, retrying...');
          this.fetchSimDetails(false);
        } else {
          this.setState({ error: 'Failed to fetch, please try again later', simInfoLoading: false });
          Sentry.captureException(err, { fingerprint: 'prime_fetch_sim_details_fetch_failed' });
        }
      } else {
        if (!err.message || err.message.toLowerCase().indexOf('server error') !== -1) {
          console.log(err);
          Sentry.captureException(err, { fingerprint: 'prime_checkout_fetch_siminfo' });
        }
        this.setState({ error: err.message, simInfoLoading: false });
      }
    }
  }

  async fetchSimValid() {
    try {
      let res = await Billing.getSimValid(this.props.dongleId, this.state.simInfo.sim_id);
      if (res.error && res.error == 'sim_third_party') {
        if (this.state.simInfo.data_connected === true) {
          this.setState({ simValid: 'sim_third_party_data', simInfoLoading: false });
        } else {
          this.setState({
            error: 'Third-party SIM detected. Turn off device Wi-Fi and try again to confirm cellular data connection.',
            simInfoLoading: false
          });
        }
      } else if (res.error) {
        this.setState({ error: res.error, simInfoLoading: false });
      } else {
        this.setState({ simValid: res.result, simInfoLoading: false });
      }
    } catch (err) {
      Sentry.captureException(err, { fingerprint: 'prime_checkout_fetch_simvalid' });
      this.setState({ error: err.message, simInfoLoading: false });
    }
  }

  isTrialClaimable() {
    return this.props.subscription && this.props.subscription.trial_claimable;
  }

  firstChargeDate() {
    if (this.props.subscription) {
      return fecha.format(this.props.subscription.trial_end * 1000, "MMMM Do");
    } else {
      return null;
    }
  }

  claimEndDate() {
    if (this.props.subscription && this.props.subscription.trial_claim_end) {
      return fecha.format(this.props.subscription.trial_claim_end * 1000, "MMMM Do");
    } else {
      return null;
    }
  }

  async gotoCheckout() {
    this.setState({ loadingCheckout: true });
    try {
      const resp = await Billing.getStripeCheckout(this.props.dongleId, this.state.simInfo.sim_id);
      window.location = resp.url;
    } catch (err) {
      // TODO show error messages
      console.log(err);
      Sentry.captureException(err, { fingerprint: 'prime_goto_stripe_checkout' });
    }
  }

  render() {
    const { classes, device } = this.props;
    const { windowWidth, simInfo, simValid, simInfoLoading, error, loadingCheckout } = this.state;

    const alias = device.alias || deviceTypePretty(device.device_type);

    let chargeText = [
      'Continue to checkout to set up comma prime.',
      'You will be charged $24.00 today and monthly thereafter.',
    ];
    if (this.isTrialClaimable()) {
      const claminEndDate = this.claimEndDate();
      chargeText = [
        'Continue to checkout to claim your trial' + (claminEndDate ? `, offer only valid until ${claminEndDate}.` : '.'),
        `You will be charged $24.00 on ${this.firstChargeDate()} and monthly thereafter.`
      ];
    }

    const simId = simInfo ? simInfo.sim_id : null;
    const containerPadding = windowWidth > 520 ? 36 : 16;
    const buttonSmallStyle = windowWidth < 514 ? { width: '100%' } : {};

    return ( <>
      <div className={ classes.primeBox }>
        <ResizeHandler onResize={ (windowWidth) => this.setState({ windowWidth }) } />
        <div className={ classes.primeContainer } style={{ padding: `8px ${containerPadding}px` }}>
          <IconButton aria-label="Go Back" onClick={() => this.props.dispatch(primeNav(false)) }>
            <KeyboardBackspaceIcon />
          </IconButton>
        </div>
        <div className={ classes.primeContainer } style={{ padding: `16px ${containerPadding}px` }}>
          <Typography variant="title">comma prime</Typography>
          <Typography className={ classes.introLine }>Become a comma prime member today for only $24/month</Typography>
          <PrimeChecklist />
        </div>
        <div className={ classes.primeContainer } style={{ padding: `16px ${containerPadding}px` }}>
          <Typography variant="title">checkout</Typography>
          { error && <div className={ classes.overviewBlockError }>
            <ErrorIcon />
            <Typography>{ error }</Typography>
          </div> }
          { simValid == 'sim_third_party_data' && <div className={ classes.overviewBlockWarning }>
            <WarningIcon />
            <Typography>
              Third-party SIM detected, comma prime can be activated, but no data connection will be provided.
            </Typography>
          </div> }
          { simInfoLoading && <div className={ classes.overviewBlockLoading }>
            <CircularProgress size={ 19 } style={{ color: Colors.white }} />
            <Typography>Fetching SIM data</Typography>
          </div> }
          <div className={ classes.overviewBlock }>
            <Typography variant="subheading">Device</Typography>
            <div className={ classes.deviceBlock }>
              <Typography variant="body2">{ alias }</Typography>
              <Typography variant="caption" className={classes.deviceId}>({ device.dongle_id })</Typography>
            </div>
          </div>
          <div className={ classes.overviewBlock }>
            { chargeText.map((txt, i) => {
              return <Typography key={i} className={ classes.chargeText }>{ txt }</Typography>
            }) }
          </div>
          <div className={ classes.overviewBlock }>
            <Button className={ classes.buttons } style={ buttonSmallStyle } onClick={ this.gotoCheckout }
              disabled={ Boolean(!simId || loadingCheckout) }>
              { loadingCheckout ? <CircularProgress size={ 19 } /> : 'Go to checkout' }
            </Button>
          </div>
        </div>
      </div>
    </> );
  }
}

const stateToProps = Obstruction({
  dongleId: 'workerState.dongleId',
  device: 'workerState.device',
  subscription: 'workerState.subscription',
});

export default connect(stateToProps)(withStyles(styles)(PrimeCheckout));

