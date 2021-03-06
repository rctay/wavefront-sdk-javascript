import { SPAN_LOG_KEY } from './constants';

function Queue(maxQueueSize) {
  /**
   * Implements Javascript Queue.
   * @constructor
   * @param {number} maxQueueSize - The maximum capacity for the queue.
   */
  this._items = [];
  this._maxQueueSize = maxQueueSize;

  this.push = val => {
    if (this.size() >= this._maxQueueSize) {
      throw 'Exception raised because the queue is full.';
    } else {
      this._items.push(val);
    }
  };
  this.size = () => this._items.length;
  this.remainCapacity = () => this._maxQueueSize - this._items.length;
  this.toArray = () => this._items;
  this.isEmpty = () => this._items.length === 0;
}

/**
 * Returns an array with arrays of the given size.
 *
 * @param {Array} points - Array to split
 * @param {number} chunkSize - Size of every chunk
 * @return {Array}
 */
function getChunks(points, chunkSize) {
  let chunks = [];
  while (points.length) {
    chunks.push(points.splice(0, chunkSize));
  }
  return chunks;
}

/**
 * Check if a string is null or contains nothing.
 */
function isBlank(str) {
  return (
    (typeof str == 'string' && !str.trim()) ||
    typeof str == 'undefined' ||
    str === null
  );
}

/**
 * Sanitize a string, replace whitespace with "-".
 * @param {string} str - Input string.
 * @return {string} str - Sanitized string.
 */
function sanitize(str) {
  if (str == null) return str;
  let sanitized = str.replace(/\s/g, '-');
  if (sanitized.indexOf('"') >= 0) {
    sanitized = sanitized.replace(/["]+/g, '\\"');
  }
  return `"${sanitized}"`;
}

/**
 * Metric Data to String.
 *     Wavefront Metrics Data format
 *     <metricName> <metricValue> [<timestamp>] source=<source> [pointTags]
 *     Example: "new-york.power.usage 42422 1533531013 source=localhost datacenter=dc1"
 * @param {string} name - Metric name
 * @param {Number} value - Metric value
 * @param {Number} timestamp
 * @param {string} source
 * @param {Object} tags
 * @param defaultSource
 * @return {string}
 */
function metricToLineData(name, value, timestamp, source, tags, defaultSource) {
  if (isBlank(name)) {
    throw 'Metrics name cannot be blank';
  }
  if (isBlank(source)) {
    source = defaultSource;
  }
  let strBuilder = [sanitize(name), value.toString()];
  if (timestamp) {
    strBuilder.push(timestamp);
  }
  strBuilder.push('source=' + sanitize(source));
  if (tags) {
    for (const [key, value] of Object.entries(tags)) {
      if (isBlank(key)) {
        throw 'Metric point tag key cannot be blank';
      }
      if (isBlank(value)) {
        throw 'Metric point tag value cannot be blank';
      }
      strBuilder.push(sanitize(key) + '=' + sanitize(value));
    }
  }
  return strBuilder.join(' ') + '\n';
}

/**
 * Histogram Data to String.
 *     Wavefront Histogram Data format
 *     {!M | !H | !D} [<timestamp>] #<count> <mean> [centroids] <histogramName> source=<source> [pointTags]
 *     Example: "!M 1533531013 #20 30.0 #10 5.1 request.latency source=appServer1 region=us-west"
 * @param {string} name - Histogram name
 * @param {Array} centroids - List of centroids(pairs)
 * @param {Set} histogramGranularities
 * @param {Number} timestamp
 * @param {string} source
 * @param {Object} tags
 * @param {string} defaultSource
 * @return {string}
 */
function histogramToLineData(
  name,
  centroids,
  histogramGranularities,
  timestamp,
  source,
  tags,
  defaultSource
) {
  if (isBlank(name)) {
    throw 'Histogram name cannot be blank';
  }
  if (!histogramGranularities || histogramGranularities.size === 0) {
    throw 'Histogram granularities cannot be null or empty';
  }
  if (!centroids) {
    throw 'A distribution should have at least one centroid';
  }
  if (isBlank(source)) {
    source = defaultSource;
  }

  let lineBuilder = [];
  for (let histogramGranularity of histogramGranularities) {
    let strBuilder = [histogramGranularity];
    if (timestamp) {
      strBuilder.push(timestamp);
    }
    for (const [value, count] of centroids) {
      strBuilder.push('#' + count.toString());
      strBuilder.push(value.toString());
    }
    strBuilder.push(sanitize(name));
    strBuilder.push('source=' + sanitize(source));
    if (tags) {
      for (const [key, value] of Object.entries(tags)) {
        if (isBlank(key)) {
          throw 'Histogram tag key cannot be blank';
        }
        if (isBlank(value)) {
          throw 'Histogram tag value cannot be blank';
        }
        strBuilder.push(sanitize(key) + '=' + sanitize(value));
      }
    }
    lineBuilder.push(strBuilder.join(' '));
  }
  return lineBuilder.join('\n') + '\n';
}

/**
 * Tracing span Data to String.
 *     Wavefront Histogram Data format
 *     <tracingSpanName> source=<source> [pointTags] <start_millis>
 *     Example: "getAllUsers source=localhost
 *     traceId=7b3bf470-9456-11e8-9eb6-529269fb1459
 *     spanId=0313bafe-9457-11e8-9eb6-529269fb1459
 *     parent=2f64e538-9457-11e8-9eb6-529269fb1459
 *     application=Wavefront http.method=GET
 *     1533531013 343500"
 * @param {string} name - Span name
 * @param {number} startMillis - Start time
 * @param {number} durationMillis - Duration time
 * @param {string} source
 * @param {string} traceId
 * @param {string} spanId
 * @param {Array} parents - Array of UUID
 * @param {Array} followsFrom - Array of UUID
 * @param {Object} tags
 * @param {Map} spanLogs
 * @param {string} defaultSource
 * @return {string}
 */
function tracingSpanToLineData(
  name,
  startMillis,
  durationMillis,
  source,
  traceId,
  spanId,
  parents,
  followsFrom,
  tags,
  spanLogs,
  defaultSource
) {
  if (isBlank(name)) {
    throw 'Span name cannot be blank';
  }
  if (isBlank(source)) {
    source = defaultSource;
  }

  let strBuilder = [
    sanitize(name),
    'source=' + sanitize(source),
    'traceId=' + traceId,
    'spanId=' + spanId
  ];
  if (parents) {
    parents.forEach(uuid => strBuilder.push('parent=' + uuid));
  }
  if (followsFrom) {
    followsFrom.forEach(uuid => strBuilder.push('followsFrom=' + uuid));
  }
  if (spanLogs) {
    tags.push([SPAN_LOG_KEY, 'true']);
  }
  if (tags) {
    let tagSet = new Set();
    for (const [key, value] of tags) {
      if (isBlank(key)) {
        throw 'Histogram tag key cannot be blank';
      }
      if (isBlank(value)) {
        throw 'Histogram tag value cannot be blank';
      }
      let curTag = sanitize(key) + '=' + sanitize(value);
      if (!tagSet.has(curTag)) {
        strBuilder.push(curTag);
        tagSet.add(curTag);
      }
    }
  }
  strBuilder.push(startMillis);
  strBuilder.push(durationMillis);
  return strBuilder.join(' ') + '\n';
}

/**
 * Wavefront Tracing Span Log to JSON format.
 * @param {string} traceId - Trace ID
 * @param {string} spanId - Span ID
 * @param {string} spanLogs - Span Log
 * @param {string} scrambler - Additional UUID, optional
 * @return {string} Span Log in JSON format
 */
function spanLogToLineData(traceId, spanId, spanLogs, scrambler = null) {
  let spanLogMap = new Map([
    ['traceId', traceId],
    ['spanId', spanId],
    ['logs', spanLogs]
  ]);
  if (scrambler) {
    spanLogMap.set('_scrambler', scrambler);
  }
  return JSON.stringify(spanLogMap);
}

export {
  metricToLineData,
  histogramToLineData,
  tracingSpanToLineData,
  spanLogToLineData,
  isBlank,
  sanitize,
  getChunks,
  Queue
};
