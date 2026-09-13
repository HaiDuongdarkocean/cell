# Code Simplification — before/after examples

## TypeScript

```typescript
// Unnecessary async wrapper
async function getUser(id: string): Promise<User> {
  return await userService.findById(id);
}
// →
function getUser(id: string): Promise<User> {
  return userService.findById(id);
}

// Verbose conditional assignment
let displayName: string;
if (user.nickname) {
  displayName = user.nickname;
} else {
  displayName = user.fullName;
}
// →
const displayName = user.nickname || user.fullName;

// Manual array building
const activeUsers: User[] = [];
for (const user of users) {
  if (user.isActive) activeUsers.push(user);
}
// →
const activeUsers = users.filter((user) => user.isActive);

// Redundant boolean return
function isValid(input: string): boolean {
  if (input.length > 0 && input.length < 100) return true;
  return false;
}
// →
function isValid(input: string): boolean {
  return input.length > 0 && input.length < 100;
}
```

## React / JSX

```tsx
// Verbose conditional rendering
function UserBadge({ user }: Props) {
  if (user.isAdmin) {
    return <Badge variant="admin">Admin</Badge>;
  }
  return <Badge variant="default">User</Badge>;
}
// →
function UserBadge({ user }: Props) {
  return (
    <Badge variant={user.isAdmin ? 'admin' : 'default'}>
      {user.isAdmin ? 'Admin' : 'User'}
    </Badge>
  );
}
```

Prop drilling through intermediate components: context or composition may solve it better — a judgment call; flag it, don't auto-refactor.

## Preparatory refactoring example

```typescript
// Before: new feature added directly to a 900-line controller
function BigController() {
  // ... 800 lines ...
  applyStudyMode(mode) { /* new code */ }  // inflates the file
}

// After: extract playback state into a hook first
function usePlaybackState() { /* extracted */ }
function BigController() {
  const playback = usePlaybackState();
  applyStudyMode(mode) { /* calls playback.set... */ }
}
```
