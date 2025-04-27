import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  Flex,
  Icon,
  Avatar,
  InputGroup,
  InputRightElement,
  useToast,
} from "@chakra-ui/react";
import { FiSend, FiInfo, FiMessageCircle } from "react-icons/fi";
import UsersList from "./UsersList";
import { useEffect, useRef, useState } from "react";
import axios from "axios";

const ChatArea = ({ selectedGroup, socket }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const messagesEndRef = useRef(null);
  const typingTimeOutRef = useRef(null);
  const toast = useToast();

  const currentUser = JSON.parse(localStorage.getItem("userInfo") || {});

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

  useEffect(() => {
    if (selectedGroup && socket) {
      const fetchMessages = async () => {
        const token = currentUser?.token;
        try {
          const { data } = await axios.get(
            `https://agoralink.onrender.com/api/messages/${selectedGroup?._id}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          setMessages(data);
        } catch (error) {
          console.log(error);
        }
      };

      fetchMessages();
      socket.emit("join room", selectedGroup?._id);

      socket.on("message received", (newMessage) => {
        setMessages((prev) => [...prev, newMessage]);
      });

      socket.on("users in room", (users) => {
        setConnectedUsers(users);
      });

      socket.on("user joined", (user) => {
        setConnectedUsers((prev) => [...prev, user]);
      });

      socket.on("user left", (userId) => {
        setConnectedUsers((prev) =>
          prev.filter((user) => user?._id !== userId)
        );
      });

      socket.on("notification", (notification) => {
        toast({
          title:
            notification.type === "USER_JOINED" ? "New User" : "Notification",
          description: notification.message,
          status: "info",
          duration: 3000,
          isClosable: true,
          position: "top-right",
        });
      });

      socket.on("user typing", ({ username }) => {
        setTypingUsers((prev) => new Set([...prev, username]));
      });

      socket.on("user stop typing", ({ username }) => {
        setTypingUsers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(username);
          return newSet;
        });
      });

      return () => {
        socket.emit("leave room", selectedGroup?._id);
        socket.off("message received");
        socket.off("users in room");
        socket.off("user joined");
        socket.off("user left");
        socket.off("user typing");
        socket.off("user stop typing");
        socket.off("notification");
      };
    }
  }, [selectedGroup, socket, toast, currentUser?.token]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const { data } = await axios.post(
        "https://agoralink.onrender.com/api/messages",
        {
          content: newMessage,
          groupId: selectedGroup?._id,
        },
        {
          headers: {
            Authorization: `Bearer ${currentUser?.token}`,
          },
        }
      );

      socket.emit("new message", {
        ...data,
        groupId: selectedGroup?._id,
      });
      setMessages((prev) => [...prev, data]);
      setNewMessage("");
    } catch (error) {
      toast({
        title: "Error sending message",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);

    if (!isTyping && selectedGroup) {
      setIsTyping(true);
      socket.emit("typing", {
        groupId: selectedGroup?._id,
        username: currentUser?.username,
      });
    }

    clearTimeout(typingTimeOutRef.current);
    typingTimeOutRef.current = setTimeout(() => {
      socket.emit("stop typing", {
        groupId: selectedGroup?._id,
        username: currentUser?.username,
      });
      setIsTyping(false);
    }, 2000);
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderTypingIndicator = () => {
    if (typingUsers.size === 0) return null;

    return Array.from(typingUsers).map((username) => (
      <Box
        key={username}
        alignSelf={
          username === currentUser?.username ? "flex-start" : "flex-end"
        }
        maxW="70%"
        mb={2}
      >
        <Flex
          align="center"
          bg={username === currentUser?.username ? "blue.50" : "gray.50"}
          p={2}
          borderRadius="lg"
          gap={2}
        >
          {username === currentUser?.username ? (
            <>
              <Avatar size="xs" name={username} />
              <Flex align="center" gap={1}>
                <Text fontSize="sm" color="gray.500" fontStyle="italic">
                  You are typing
                </Text>
                <Flex gap={1}>
                  {[...Array(3)].map((_, i) => (
                    <Box
                      key={i}
                      w="3px"
                      h="3px"
                      borderRadius="full"
                      bg="gray.500"
                    />
                  ))}
                </Flex>
              </Flex>
            </>
          ) : (
            <>
              <Flex align="center" gap={1}>
                <Text fontSize="sm" color="gray.500" fontStyle="italic">
                  {username} is typing
                </Text>
                <Flex gap={1}>
                  {[...Array(3)].map((_, i) => (
                    <Box
                      key={i}
                      w="3px"
                      h="3px"
                      borderRadius="full"
                      bg="gray.500"
                    />
                  ))}
                </Flex>
              </Flex>
              <Avatar size="xs" name={username} />
            </>
          )}
        </Flex>
      </Box>
    ));
  };

  return (
    <Flex h="100%" position="relative">
      <Box
        flex="1"
        display="flex"
        flexDirection="column"
        bg="gray.50"
        maxW={`calc(100% - 260px)`}
      >
        {selectedGroup ? (
          <>
            <Flex
              px={6}
              py={4}
              bg="white"
              borderBottom="1px solid"
              borderColor="gray.200"
              align="center"
              boxShadow="sm"
            >
              <Icon as={FiMessageCircle} fontSize="24px" color="blue.500" mr={3} />
              <Box flex="1">
                <Text fontSize="lg" fontWeight="bold" color="gray.800">
                  {selectedGroup.name}
                </Text>
                <Text fontSize="sm" color="gray.500">
                  {selectedGroup.description}
                </Text>
              </Box>
              <Icon
                as={FiInfo}
                fontSize="20px"
                color="gray.400"
                cursor="pointer"
                _hover={{ color: "blue.500" }}
              />
            </Flex>

            <VStack
              flex="1"
              overflowY="auto"
              spacing={4}
              align="stretch"
              px={6}
              py={4}
            >
              {messages.map((message) => (
                <Box
                  key={message._id}
                  alignSelf={
                    message.sender._id === currentUser?._id ? "flex-end" : "flex-start"
                  }
                  maxW="70%"
                >
                  <Flex direction="column" gap={1}>
                    <Flex
                      align="center"
                      mb={1}
                      justifyContent={
                        message.sender._id === currentUser?._id ? "flex-end" : "flex-start"
                      }
                      gap={2}
                    >
                      {message.sender._id === currentUser?._id ? (
                        <>
                          <Text fontSize="xs" color="gray.500">
                            You • {formatTime(message.createdAt)}
                          </Text>
                          <Avatar size="xs" name={message.sender.username} />
                        </>
                      ) : (
                        <>
                          <Avatar size="xs" name={message.sender.username} />
                          <Text fontSize="xs" color="gray.500">
                            {message.sender.username} • {formatTime(message.createdAt)}
                          </Text>
                        </>
                      )}
                    </Flex>
                    <Box
                      bg={
                        message.sender._id === currentUser?._id ? "blue.500" : "white"
                      }
                      color={
                        message.sender._id === currentUser?._id ? "white" : "gray.800"
                      }
                      p={3}
                      borderRadius="lg"
                      boxShadow="sm"
                    >
                      <Text>{message.content}</Text>
                    </Box>
                  </Flex>
                </Box>
              ))}
              {renderTypingIndicator()}
              <div ref={messagesEndRef} />
            </VStack>

            <Box
              p={4}
              bg="white"
              borderTop="1px solid"
              borderColor="gray.200"
              position="relative"
              zIndex="1"
            >
              <InputGroup size="lg">
                <Input
                  placeholder="Type your message..."
                  pr="4.5rem"
                  bg="gray.50"
                  border="none"
                  value={newMessage}
                  onChange={handleTyping}
                  onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                  _focus={{
                    boxShadow: "none",
                    bg: "gray.100",
                  }}
                />
                <InputRightElement width="4.5rem">
                  <Button
                    h="1.75rem"
                    size="sm"
                    colorScheme="blue"
                    borderRadius="full"
                    onClick={sendMessage}
                    _hover={{
                      transform: "translateY(-1px)",
                    }}
                    transition="all 0.2s"
                  >
                    <Icon as={FiSend} />
                  </Button>
                </InputRightElement>
              </InputGroup>
            </Box>
          </>
        ) : (
          <Flex
            h="100%"
            direction="column"
            align="center"
            justify="center"
            p={8}
            textAlign="center"
          >
            <Icon as={FiMessageCircle} fontSize="64px" color="gray.300" mb={4} />
            <Text fontSize="xl" fontWeight="medium" color="gray.500" mb={2}>
              Welcome to the Chat
            </Text>
            <Text color="gray.500" mb={2}>
              Select a group from sidebar to start chatting
            </Text>
          </Flex>
        )}
      </Box>

      <Box
        width="260px"
        position="sticky"
        right={0}
        top={0}
        height="100%"
        flexShrink={0}
      >
        {selectedGroup && <UsersList users={connectedUsers} />}
      </Box>
    </Flex>
  );
};

export default ChatArea;