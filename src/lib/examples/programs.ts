export interface Example {
  name: string;
  description: string;
  code: string;
}

export const examples: Example[] = [
  {
    name: 'Hello World',
    description: 'Basic output',
    code: `print("Hello, ChocoPy!")
print(42)
print(True)
print(False)
`
  },
  {
    name: 'Variables & Expressions',
    description: 'Arithmetic and comparisons',
    code: `x: int = 10
y: int = 3

print(x + y)
print(x - y)
print(x * y)
print(x // y)
print(x % y)
print(x > y)
print(x == y)
print(x != y)
`
  },
  {
    name: 'Control Flow',
    description: 'If/elif/else and while',
    code: `n: int = 10
i: int = 1
total: int = 0

while i <= n:
    total = total + i
    i = i + 1

print(total)

if total > 50:
    print("Greater than 50")
elif total == 55:
    print("Exactly 55!")
else:
    print("50 or less")
`
  },
  {
    name: 'Functions',
    description: 'Function definitions and calls',
    code: `def factorial(n: int) -> int:
    if n <= 1:
        return 1
    else:
        return n * factorial(n - 1)

def fibonacci(n: int) -> int:
    if n <= 1:
        return n
    else:
        return fibonacci(n - 1) + fibonacci(n - 2)

print(factorial(10))
print(fibonacci(10))
`
  },
  {
    name: 'Strings',
    description: 'String operations',
    code: `greeting: str = "Hello"
name: str = "World"

print(greeting + ", " + name + "!")
print(len(greeting))
print(greeting[0])
print(greeting[4])

c: str = ""
for c in greeting:
    print(c)
`
  },
  {
    name: 'Lists',
    description: 'List creation and indexing',
    code: `numbers: [int] = None
i: int = 0

numbers = [10, 20, 30, 40, 50]
print(numbers[0])
print(numbers[4])
print(len(numbers))

numbers = numbers + [60, 70]
print(len(numbers))

for i in numbers:
    print(i)
`
  },
  {
    name: 'Classes',
    description: 'Object-oriented programming',
    code: `class Animal(object):
    name: str = ""
    sound: str = ""

    def __init__(self: "Animal"):
        pass

    def speak(self: "Animal") -> str:
        return self.name + " says " + self.sound

class Dog(Animal):
    def __init__(self: "Dog"):
        self.name = "Dog"
        self.sound = "Woof"

class Cat(Animal):
    def __init__(self: "Cat"):
        self.name = "Cat"
        self.sound = "Meow"

dog: Dog = None
cat: Cat = None
dog = Dog()
cat = Cat()
print(dog.speak())
print(cat.speak())
`
  },
  {
    name: 'Nested Functions',
    description: 'Closures and nonlocal',
    code: `def make_counter() -> object:
    count: int = 0

    def increment() -> int:
        nonlocal count
        count = count + 1
        return count

    return increment

counter: object = None
counter = make_counter()
`
  },
  {
    name: 'Linked List',
    description: 'Recursive data structures',
    code: `class Node(object):
    value: int = 0
    next: "Node" = None

def make_node(val: int) -> Node:
    n: Node = None
    n = Node()
    n.value = val
    return n

def print_list(head: Node):
    current: Node = None
    current = head
    while not (current is None):
        print(current.value)
        current = current.next

head: Node = None
n2: Node = None
n3: Node = None

head = make_node(1)
n2 = make_node(2)
n3 = make_node(3)
head.next = n2
n2.next = n3

print_list(head)
`
  },
  {
    name: 'Binary Search',
    description: 'Search algorithm',
    code: `def binary_search(items: [int], target: int) -> int:
    lo: int = 0
    hi: int = 0
    mid: int = 0
    hi = len(items) - 1

    while lo <= hi:
        mid = (lo + hi) // 2
        if items[mid] == target:
            return mid
        elif items[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1

    return -1

data: [int] = None
data = [2, 5, 8, 12, 16, 23, 38, 42, 56, 72, 91]

print(binary_search(data, 23))
print(binary_search(data, 42))
print(binary_search(data, 99))
`
  },
  {
    name: 'Type Errors',
    description: 'Intentional type errors',
    code: `x: int = 1
y: str = "hello"

# This will produce a type error
x = y

# Calling with wrong argument types
def add(a: int, b: int) -> int:
    return a + b

add("hello", "world")
`
  },
  {
    name: 'For Loops',
    description: 'Iteration patterns',
    code: `a: str = ""
c: int = 0

for a in "abcde":
    print(a)

for c in [1, 2, 3] + [11, 22, 33]:
    print(c)

items: [[int]] = None
row: [int] = None
val: int = 0
items = [[9, 8, 7], [6, 5, 4], [3, 2, 1]]
for row in items:
    for val in row:
        print(val)
`
  }
];
