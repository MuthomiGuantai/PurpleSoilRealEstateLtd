import prisma from "../lib/prisma.js";

const handleError = (res, err, message) => {
  console.error(err);
  return res.status(500).json({ message });
};

const unique = (arr) => [...new Set(arr)];

export const getChats = async (req, res) => {
  const tokenUserId = req.userId;

  try {
    const chats = await prisma.chat.findMany({
      where: {
        userIDs: {
          hasSome: [tokenUserId],
        },
      },
    });

    const receiverIds = chats
      .map((chat) => chat.userIDs.find((id) => id !== tokenUserId))
      .filter(Boolean);

    const receivers = await prisma.user.findMany({
      where: { id: { in: unique(receiverIds) } },
      select: { id: true, username: true, avatar: true },
    });

    const receiverById = new Map(receivers.map((u) => [u.id, u]));

    const result = chats.map((chat) => {
      const receiverId = chat.userIDs.find((id) => id !== tokenUserId);
      return {
        ...chat,
        receiver: receiverId ? (receiverById.get(receiverId) ?? null) : null,
      };
    });

    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err, "Failed to get chats!");
  }
};

export const getChat = async (req, res) => {
  const tokenUserId = req.userId;
  const chatId = req.params.id;

  try {
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        userIDs: { hasSome: [tokenUserId] },
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!chat) return res.status(404).json({ message: "Chat not found!" });

    await prisma.chat.update({
      where: { id: chatId },
      data: {
        seenBy: {
          set: unique([...(chat.seenBy ?? []), tokenUserId]),
        },
      },
    });

    return res.status(200).json(chat);
  } catch (err) {
    return handleError(res, err, "Failed to get chat!");
  }
};

export const addChat = async (req, res) => {
  const tokenUserId = req.userId;
  const { receiverId } = req.body;

  if (!receiverId) {
    return res.status(400).json({ message: "receiverId is required!" });
  }

  if (receiverId === tokenUserId) {
    return res.status(400).json({ message: "You can't create a chat with yourself!" });
  }

  try {
    const receiverExists = await prisma.user.findUnique({
      where: { id: receiverId },
      select: { id: true },
    });

    if (!receiverExists) {
      return res.status(400).json({ message: "Receiver user not found!" });
    }

    const newChat = await prisma.chat.create({
      data: {
        userIDs: [tokenUserId, receiverId],
      },
    });
    return res.status(200).json(newChat);
  } catch (err) {
    return handleError(res, err, "Failed to add chat!");
  }
};

export const readChat = async (req, res) => {
  const tokenUserId = req.userId;
  const chatId = req.params.id;

  try {
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        userIDs: { hasSome: [tokenUserId] },
      },
      select: { id: true, seenBy: true },
    });

    if (!chat) return res.status(404).json({ message: "Chat not found!" });

    const updated = await prisma.chat.update({
      where: { id: chatId },
      data: {
        seenBy: {
          set: unique([...(chat.seenBy ?? []), tokenUserId]),
        },
      },
    });

    return res.status(200).json(updated);
  } catch (err) {
    return handleError(res, err, "Failed to read chat!");
  }
};
