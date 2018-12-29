function median(data) {
    data = data.slice().sort();
    let index = Math.floor(data.length / 2);
    return data.length % 2 ?
        data[index] :
        (data[index-1] + data[index]) * 0.5;
}

function meanp(data) {
  return data.reduce((v, a) => v + a, 0) /
      (data.length);
}

function means(data) {
  return data.reduce((v, a) => v + a, 0) /
      (data.length - 1);
}

function varp(data) {
  let m = meanp(data);
  return meanp(data.map(v => (v - m) * (v - m)));
}

function vars(data) {
  let m = meanp(data);
  return means(data.map(v => (v - m) * (v - m)));
}

function stdevp(data) {
  return Math.sqrt(varp(data));
}

function stdevs(data) {
  return Math.sqrt(vars(data));
}

function covarp(dataX, dataY) {
  let mX = meanp(dataX);
  let mY = meanp(dataY);
  return meanp(dataX.map((v, i) => (v - mX) * (dataY[i] - mY)));
}

function covars(dataX, dataY) {
  let mX = meanp(dataX);
  let mY = meanp(dataY);
  return means(dataX.map((v, i) => (v - mX) * (dataY[i] - mY)));
}

function correl(dataX, dataY) {
  return covarp(dataX, dataY) /
      (stdevp(dataX) * stdevp(dataY));
}

function slope(dataX, dataY) {
  return covarp(dataX, dataY) / varp(dataX);
}

function intercept(dataX, dataY) {
  let mX = meanp(dataX);
  let mY = meanp(dataY);
  return mY - slope(dataX, dataY) * mX;
}

function steyx(dataX, dataY) {
  let mX = meanp(dataX);
  let mY = meanp(dataY);
  let vX = dataX.map(v => (v - mX) ** 2).reduce((v, a) => v + a, 0);
  let vY = dataY.map(v => (v - mY) ** 2).reduce((v, a) => v + a, 0);
  let cXY = dataX.map((v, i) => (v - mX) * (dataY[i] - mY)).reduce((v, a) => v + a, 0);
  return Math.sqrt((vY - (cXY * cXY) / vX) / (dataX.length - 2));
}

function inverseCdf(p) {
  if (p >= 0.5) {
      return 5.5556 * (1 - ((1 - p) / p) ** 0.1186);
  }
  else {
      return -5.5556 * (1 - ((p - 1) / p) ** 0.1186);
  }
}

const a1 = -3.969683028665376e+01;
const a2 = 2.209460984245205e+02;
const a3 = -2.759285104469687e+02;
const a4 = 1.383577518672690e+02;
const a5 = -3.066479806614716e+01;
const a6 = 2.506628277459239e+00;

const b1 = -5.447609879822406e+01;
const b2 = 1.615858368580409e+02;
const b3 = -1.556989798598866e+02;
const b4 = 6.680131188771972e+01;
const b5 = -1.328068155288572e+01;

const c1 = -7.784894002430293e-03;
const c2 = -3.223964580411365e-01;
const c3 = -2.400758277161838e+00;
const c4 = -2.549732539343734e+00;
const c5 = 4.374664141464968e+00;
const c6 = 2.938163982698783e+00;

const d1 = 7.784695709041462e-03;
const d2 = 3.224671290700398e-01;
const d3 = 2.445134137142996e+00;
const d4 = 3.754408661907416e+00;

const p_low = 0.02425;
const p_high = 1 - p_low;

function inverseCdf2(p) {

  if (0 < p && p < p_low) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
          ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  }
  else if (p_low <= p && p <= p_high) {
      q = p - 0.5;
      r = q * q;
      return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
          (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
  }
  if (p_high < p && p < 1) {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
          ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  }
}

let normsinv = inverseCdf2;

function norminv(p, mean, standardDev) {
return mean + standardDev*normsinv(p);
}

function confidence(alpha, standardDev, size) {
  return normsinv(1 - alpha / 2) * standardDev / Math.sqrt(size);
}

function kurt(data) {
  let n = data.length;
  let s = stdevs(data);
  let m = meanp(data);
  let sum = data.map(v => ((v-m)/s)**4).reduce((v, a) => v + a, 0);
  return (n*(n+1))/((n-1)*(n-2)*(n-3))*sum - (3*(n-1)**2)/((n-2)*(n-3));
}

function skewp(data) {
  let n = data.length;
  let s = stdevp(data);
  let m = meanp(data);
  return data.map(v => ((v-m)/s)**3).reduce((v, a) => v + a, 0) / n;
}

function skews(data) {
  let n = data.length;
  let s = stdevs(data);
  let m = meanp(data);
  return data.map(v => ((v-m)/s)**3).reduce((v, a) => v + a, 0) * n / ((n-1)*(n-2));
}

function mode(data) {
  let sorted = data.slice().sort();
  let currentValue;
  let currentCount = 0;
  let maxValue;
  let maxCount = 0;
  sorted.forEach(v => {
      if (currentValue && currentValue == v) {
          currentCount++;
      }
      else {
          if (currentValue) {
              if (currentCount >= maxCount) {
                  maxValue = currentValue;
                  maxCount = currentCount;
              }
          }
          currentValue = v;
          currentCount = 1;
      }
  });
  return maxValue;
}

module.exports = {
    median:median,
    meanp: meanp,
    means: means,
    varp: varp,
    vars: vars,
    stdevp: stdevp,
    stdevs: stdevs,
    covarp: covarp,
    covars: covars,
    correl: correl,
    confidence: confidence
};