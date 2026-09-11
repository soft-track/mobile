import { errorDetail, isNetworkError } from '@/api/errors';

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
