import {
  errorDetail,
  formatDuration,
  isNetworkError,
  retryAfterSeconds,
} from '@/api/errors';

describe('errorDetail', () => {
  it('uses the string detail a hand-raised HTTPException sends', () => {
    // What POST /auth/login actually returns for a bad password.
    const err = { response: { data: { detail: 'Incorrect email or password' } } };
    expect(errorDetail(err, 'fallback')).toBe('Incorrect email or password');
  });

  it('joins the messages out of a 422 validation array', () => {
    // FastAPI reports validation failures as an array under the same key.
    const err = {
      response: {
        data: {
          detail: [
            { loc: ['body', 'password'], msg: 'String should have at least 8 characters' },
            { loc: ['body', 'email'], msg: 'value is not a valid email address' },
          ],
        },
      },
    };
    expect(errorDetail(err, 'fallback')).toBe(
      'String should have at least 8 characters. value is not a valid email address',
    );
  });

  it('falls back when there is no usable detail', () => {
    expect(errorDetail({ response: { data: {} } }, 'fallback')).toBe('fallback');
    expect(errorDetail({ response: { data: { detail: '' } } }, 'fallback')).toBe('fallback');
    expect(errorDetail({ response: { data: { detail: [] } } }, 'fallback')).toBe('fallback');
    expect(errorDetail({ response: { data: { detail: [{}] } } }, 'fallback')).toBe('fallback');
    expect(errorDetail(undefined, 'fallback')).toBe('fallback');
    expect(errorDetail(new Error('boom'), 'fallback')).toBe('fallback');
  });
});

describe('isNetworkError', () => {
  it('is true when the request never got an answer', () => {
    expect(isNetworkError({ code: 'ERR_NETWORK' })).toBe(true);
    expect(isNetworkError({ code: 'ECONNABORTED' })).toBe(true);
    expect(isNetworkError({})).toBe(true);
  });

  it('is false when the server answered, however badly', () => {
    expect(isNetworkError({ response: { status: 401 } })).toBe(false);
    expect(isNetworkError({ response: { status: 500 } })).toBe(false);
  });
});

describe('retryAfterSeconds', () => {
  it('reads the header the throttle sends', () => {
    // backend/lib_utils/rate_limit.py sets Retry-After alongside the 429.
    expect(
      retryAfterSeconds({ response: { status: 429, headers: { 'retry-after': '90' } } }),
    ).toBe(90);
  });

  it('rounds a fractional wait up, so the message never undersells it', () => {
    expect(
      retryAfterSeconds({ response: { status: 429, headers: { 'retry-after': '2.4' } } }),
    ).toBe(3);
  });

  it('is null for anything that is not a throttle', () => {
    expect(retryAfterSeconds({ response: { status: 401 } })).toBeNull();
    expect(
      retryAfterSeconds({ response: { status: 429, headers: { 'retry-after': 'soon' } } }),
    ).toBeNull();
    expect(retryAfterSeconds({ response: { status: 429, headers: {} } })).toBeNull();
    expect(retryAfterSeconds(new Error('boom'))).toBeNull();
  });
});

describe('formatDuration', () => {
  it('reads as something a person would say', () => {
    expect(formatDuration(1)).toBe('1 second');
    expect(formatDuration(45)).toBe('45 seconds');
    expect(formatDuration(60)).toBe('1 minute');
    // Rounded up: telling someone 1 minute when it is 90s earns a second failure.
    expect(formatDuration(90)).toBe('2 minutes');
  });
});
