import React from 'react';
import PropTypes from 'prop-types';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js';
import bar from 'plotly.js/lib/bar';
import pie from 'plotly.js/lib/pie';
import histogram from 'plotly.js/lib/histogram';
import box from 'plotly.js/lib/box';
import heatmap from 'plotly.js/lib/heatmap';
import { each, isArray, isObject } from 'lodash';

import { SeriesOptions, ValuesOptions, RefObject } from '@/components/proptypes';
import { normalizeValue, updateData, prepareData, prepareLayout } from '@/visualizations/chart/plotly/utils';


Plotly.register([bar, pie, histogram, box, heatmap]);
Plotly.setPlotConfig({
  modeBarButtonsToRemove: ['sendDataToCloud'],
});

const Plot = createPlotlyComponent(Plotly);

const timeSeriesToPlotlySeries = (ss) => {
  const x = [];
  const ys = {};
  each(ss, (series) => {
    ys[series.name] = [];
    each(series.data, (point) => {
      x.push(normalizeValue(point.x));
      ys[series.name].push(normalizeValue(point.y));
    });
  });
  return [x, ys];
};
const Point = PropTypes.exact({
  $raw: PropTypes.object,
  x: PropTypes.any,
  y: PropTypes.any,
  yError: PropTypes.any,
  unused: PropTypes.any,
  size: PropTypes.any,
  zValue: PropTypes.any,
});

const Series = PropTypes.exact({
  data: PropTypes.arrayOf(Point).isRequired,
  name: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
});

const PlotlyChartOptions = PropTypes.shape({
  globalSeriesType: PropTypes.string.isRequired,
  customCode: PropTypes.string,
  columnMapping: PropTypes.objectOf(PropTypes.string).isRequired,
  enableConsoleLogs: PropTypes.bool,
  legend: PropTypes.exact({
    enabled: PropTypes.bool.isRequired,
  }),
  textFormat: PropTypes.string.isRequired,
  xAxis: PropTypes.exact({
    labels: PropTypes.exact({ enabled: PropTypes.bool.isRequired }),
    title: PropTypes.exact({ text: PropTypes.string.isRequired }),
    type: PropTypes.string.isRequired,
  }),
  yAxis: PropTypes.arrayOf(PropTypes.shape({
    title: PropTypes.exact({ text: PropTypes.string.isRequired }),
    type: PropTypes.string.isRequired,
    rangeMin: PropTypes.number,
    rangeMax: PropTypes.number,
  })),
  sortX: PropTypes.bool.isRequired,
  series: PropTypes.exact({
    stacking: PropTypes.string,
    percentValues: PropTypes.bool,
    error_y: PropTypes.exact({
      visible: PropTypes.bool,
      type: PropTypes.string,
    }),
  }),
  seriesOptions: SeriesOptions,
  valuesOptions: ValuesOptions,
  numberFormat: PropTypes.string.isRequired,
  percentFormat: PropTypes.string.isRequired,
  showDataLabels: PropTypes.bool,
});

export default class PlotlyChart extends React.Component {
  static Options = PlotlyChartOptions
  static propTypes = {
    containerRef: RefObject.isRequired,
    options: PlotlyChartOptions.isRequired,
    series: PropTypes.arrayOf(Series).isRequired,
  }

  constructor(props) {
    super(props);
    this.state = {
      data: null,
      revision: 0,
      x: null,
      ys: null,
    };
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (nextProps.options.globalSeriesType === 'custom') {
      const [x, ys] = timeSeriesToPlotlySeries(nextProps.series);
      return { x, ys, revision: prevState.revision + 1 };
    }
    const data = prepareData(nextProps.series, nextProps.options);
    updateData(data, nextProps.options);
    return {
      data,
      revision: prevState.revision + 1,
    };
  }

  componentDidMount() {
    // XXX this is to hook up the resize logic from the angular impl of dashboard widgets
    if (this.plotRef.current) {
      this.props.containerRef.current = this.plotRef.current.el;
    }
  }

  refreshCustom = (figure, plotlyElement) => {
    Plotly.newPlot(plotlyElement);
    try {
      // eslint-disable-next-line no-new-func
      const codeCall = new Function('x, ys, element, Plotly', this.props.options.customCode);
      codeCall(this.state.x, this.state.ys, plotlyElement, Plotly);
    } catch (err) {
      if (this.props.options.enableConsoleLogs) {
        // eslint-disable-next-line no-console
        console.log(`Error while executing custom graph: ${err}`);
      }
    }
  }

  restyle = (updates) => {
    if (isArray(updates) && isObject(updates[0]) && updates[0].visible) {
      updateData(this.state.data, this.props.options);
    }
  }

  plotRef = React.createRef()

  render() {
    if (!this.props.options) { return ''; }
    return (
      <Plot
        ref={this.plotRef}
        className="plotly-chart-container"
        revision={this.state.revision}
        style={{ width: '100%', height: '100%' }}
        useResizeHandler
        config={{
          showLink: false,
          displaylogo: false,
          modeBarButtonsToRemove: ['sendDataToCloud'],
        }}
        data={this.state.data}
        layout={prepareLayout(this.props.series, this.props.options, this.state.data)}
        onRestyle={this.restyle}
        onUpdate={this.props.options.globalSeriesType === 'custom' ? this.refreshCustom : null}
      />
    );
  }
}
