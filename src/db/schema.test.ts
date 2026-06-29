import { roleEnum, profiles, posts, comments, likes, tags, postTags } from '@/db/schema';

describe('Drizzle Schema Exports', () => {
  it('should export all tables correctly', () => {
    expect(profiles).toBeDefined();
    expect(posts).toBeDefined();
    expect(comments).toBeDefined();
    expect(likes).toBeDefined();
    expect(tags).toBeDefined();
    expect(postTags).toBeDefined();
  });
});
