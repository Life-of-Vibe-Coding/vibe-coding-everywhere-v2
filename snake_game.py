import curses
import random
import time


def init_screen():
    screen = curses.initscr()
    curses.curs_set(0)
    screen.nodelay(True)
    screen.keypad(True)
    curses.start_color()
    curses.init_pair(1, curses.COLOR_GREEN, curses.COLOR_BLACK)
    curses.init_pair(2, curses.COLOR_RED, curses.COLOR_BLACK)
    return screen


def end_screen(screen):
    screen.nodelay(False)
    screen.keypad(False)
    curses.curs_set(1)
    curses.endwin()


def create_food(max_y, max_x, snake):
    while True:
        food = [random.randint(1, max_y - 2), random.randint(1, max_x - 2)]
        if food not in snake:
            return food


def draw_border(screen, max_y, max_x):
    for x in range(max_x):
        screen.addch(0, x, '#')
        screen.addch(max_y - 1, x, '#')
    for y in range(max_y):
        screen.addch(y, 0, '#')
        screen.addch(y, max_x - 1, '#')


def main(screen):
    max_y, max_x = screen.getmaxyx()
    snake = [[max_y // 2, max_x // 2], [max_y // 2, max_x // 2 - 1], [max_y // 2, max_x // 2 - 2]]
    direction = curses.KEY_RIGHT
    food = create_food(max_y, max_x, snake)
    score = 0
    speed = 0.1

    while True:
        screen.clear()
        draw_border(screen, max_y, max_x)
        screen.addstr(0, 2, f" Score: {score} ")

        key = screen.getch()
        if key in [curses.KEY_UP, curses.KEY_DOWN, curses.KEY_LEFT, curses.KEY_RIGHT]:
            direction = key
        elif key in [ord('q'), ord('Q')]:
            break

        head = snake[0][:]
        if direction == curses.KEY_UP:
            head[0] -= 1
        elif direction == curses.KEY_DOWN:
            head[0] += 1
        elif direction == curses.KEY_LEFT:
            head[1] -= 1
        elif direction == curses.KEY_RIGHT:
            head[1] += 1

        if head[0] in [0, max_y - 1] or head[1] in [0, max_x - 1] or head in snake:
            break

        snake.insert(0, head)

        if head == food:
            score += 1
            food = create_food(max_y, max_x, snake)
            speed = max(0.03, speed - 0.002)
        else:
            snake.pop()

        screen.addch(food[0], food[1], '●', curses.color_pair(2))
        for y, x in snake:
            screen.addch(y, x, '■', curses.color_pair(1))

        screen.refresh()
        time.sleep(speed)


if __name__ == "__main__":
    screen = init_screen()
    try:
        main(screen)
    finally:
        end_screen(screen)
