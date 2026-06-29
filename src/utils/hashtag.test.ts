import { parseHashtags } from './hashtag';

describe('parseHashtags', () => {
  it('should extract single hashtag from text', () => {
    expect(parseHashtags('이것은 #보드게임 입니다.')).toEqual(['보드게임']);
  });

  it('should extract multiple hashtags', () => {
    expect(parseHashtags('#보드게임 #재미있다 #동아리')).toEqual(['보드게임', '재미있다', '동아리']);
  });

  it('should return empty array if no hashtags', () => {
    expect(parseHashtags('태그가 없는 일반 텍스트입니다.')).toEqual([]);
  });

  it('should return unique tags only', () => {
    expect(parseHashtags('#보드게임 #보드게임 #게임')).toEqual(['보드게임', '게임']);
  });
});
