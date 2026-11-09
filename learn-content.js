export const LEARN_CATEGORIES = Object.freeze([
  { id: 'databases', title: 'Databases', description: 'How applications store, organize, and retrieve information.' },
  { id: 'apis-web', title: 'APIs & Web', description: 'How software systems communicate over the web.' },
  { id: 'ai-mcp', title: 'AI & MCP', description: 'The foundations behind language models and connected AI tools.' }
]);

export const LEARN_LESSONS = Object.freeze([
  {
    id: 'dbms-basics',
    categoryId: 'databases',
    title: 'Understanding DBMS',
    difficulty: 'Beginner',
    learningObjective: 'Distinguish an organized database from the software that manages it.',
    explanation: 'A database is an organized collection of information. A Database Management System (DBMS) is the software used to define, create, query, update, and control access to that database. The DBMS provides an interface between applications or people and the stored data. It can also enforce rules, coordinate concurrent work, and help protect data from accidental loss.',
    exampleTitle: 'Example: a college portal',
    practicalExample: 'A college portal stores student records in a database. The DBMS processes requests from the portal, checks permissions, and retrieves or updates the requested records.',
    typingPassage: 'An application rarely works with raw files alone. It usually needs a reliable way to store, find, change, and protect information. A database is an organized collection of that information. A database management system, or DBMS, is the software that creates and manages the database. In a college portal, the DBMS can store student records, check who may view them, and answer requests from the application. The database holds the data; the DBMS provides controlled ways to work with it.',
    recallQuestion: 'What is the difference between a database and a DBMS?',
    expectedAnswer: 'A database is an organized collection of data. A DBMS is the software that lets users and applications define, create, query, update, and control access to that database.',
    references: [
      { label: 'MongoDB: database concepts and DBMS', url: 'https://www.mongodb.com/resources/basics/databases/databases' },
      { label: 'PostgreSQL tutorial: architecture and database concepts', url: 'https://www.postgresql.org/docs/current/tutorial.html' }
    ]
  },
  {
    id: 'sql-vs-nosql',
    categoryId: 'databases',
    title: 'SQL vs NoSQL',
    difficulty: 'Beginner',
    learningObjective: 'Compare relational databases with common non-relational data models without assuming one is always better.',
    explanation: 'The phrase “SQL vs NoSQL” is shorthand for comparing relational systems with non-relational database models. SQL (Structured Query Language) is a query language, not a database model. Relational systems organize data into tables with defined columns and relationships. NoSQL, often expanded as “Not Only SQL,” is a broad label for several non-relational models, including document, key-value, graph, and wide-column databases. Their structures and query interfaces vary. Database choice depends on relationships, access patterns, consistency requirements, operational needs, and how the data is expected to evolve.',
    exampleTitle: 'Example: user profiles',
    practicalExample: 'A relational model might store users and addresses in related tables. A document database might store a user profile and its settings together in a JSON-like document. Both can be valid designs depending on how the application reads and updates the information.',
    typingPassage: 'Relational databases organize information into tables with rows and columns. SQL is commonly used to define those tables and query their data. NoSQL, often expanded as “Not Only SQL,” is a broad group of non-relational database models, including document, key-value, graph, and wide-column stores. A document database might keep a user profile and settings together in one JSON-like document. Neither approach is automatically better. Choose by considering relationships, query patterns, consistency needs, scale, and how the data model may change.',
    recallQuestion: 'Name one structural difference between relational databases and NoSQL databases, and explain why neither is always the better choice.',
    expectedAnswer: 'Relational databases organize data into related tables with rows and columns. NoSQL databases use different models, such as documents, key-value pairs, graphs, or wide columns. The best choice depends on the application’s data relationships, queries, consistency needs, and scale.',
    references: [
      { label: 'MongoDB: SQL vs NoSQL databases', url: 'https://www.mongodb.com/resources/basics/databases/nosql-explained/nosql-vs-sql' },
      { label: 'PostgreSQL tutorial', url: 'https://www.postgresql.org/docs/current/tutorial.html' }
    ]
  },
  {
    id: 'what-is-api',
    categoryId: 'apis-web',
    title: 'What is an API?',
    difficulty: 'Beginner',
    learningObjective: 'Explain how an API provides a defined interface for software components to communicate.',
    explanation: 'An Application Programming Interface (API) is a defined interface through which one software component can use another component’s data or functionality. An API describes the operations available and the inputs and outputs expected. In a web API, a client commonly sends a request to a service and receives a response. The client does not need to know how the service implements its internal logic; it needs to follow the published contract.',
    exampleTitle: 'Example: a weather application',
    practicalExample: 'A weather app can send a city name to a weather service API and receive forecast data. The app displays that response instead of implementing weather forecasting itself.',
    typingPassage: 'An application programming interface, or API, is a defined way for software components to communicate. A client sends a request using an agreed format, and a service returns a response. A weather app, for example, can request the forecast for a city from a weather service instead of calculating the forecast itself. The app only needs to understand the API rules: which endpoint to contact, which parameters to send, and how to interpret the returned data.',
    recallQuestion: 'What is an API, and what does it allow one application to do?',
    expectedAnswer: 'An API is a defined interface or contract that lets software components communicate. It allows one application to use data or functionality exposed by another component without knowing its internal implementation.',
    references: [
      { label: 'MDN: API definition and contract', url: 'https://developer.mozilla.org/en-US/docs/Glossary/API' },
      { label: 'MDN: Introduction to client-side APIs', url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Client-side_APIs/Introduction' }
    ]
  },
  {
    id: 'rest-api-basics',
    categoryId: 'apis-web',
    title: 'Understanding REST APIs',
    difficulty: 'Intermediate',
    learningObjective: 'Describe resources, HTTP methods, and stateless requests in a REST-style API.',
    explanation: 'REST (Representational State Transfer) is an architectural style for networked systems. A REST-style API commonly models information as resources identified by URLs. Clients use HTTP (Hypertext Transfer Protocol) methods to express intent: GET retrieves a representation, POST submits data for processing, PATCH applies a partial modification, and DELETE requests removal. REST emphasizes stateless interactions: each request carries the information needed to process it, rather than relying on hidden client session state on the server.',
    exampleTitle: 'Example: a task service',
    practicalExample: 'A task API might expose /tasks/42. A client can GET that URL to retrieve the task, PATCH it to change its title, or DELETE it when removal is intended. The response includes an HTTP status code describing the outcome.',
    typingPassage: 'REST is an architectural style for designing networked APIs around resources. A resource might be a task, user, or product, identified by a URL. Clients use Hypertext Transfer Protocol (HTTP) methods to express the operation: GET retrieves a representation, POST submits data, PATCH applies a partial update, and DELETE requests removal. A REST-style service is designed around stateless requests, so each request contains the information needed to process it. Status codes communicate the outcome, such as success or a missing resource.',
    recallQuestion: 'How do HTTP methods help a client interact with a resource in a REST-style API?',
    expectedAnswer: 'HTTP methods communicate the intended operation. GET retrieves a representation, POST submits data for processing, PATCH applies a partial modification, and DELETE requests removal. The server communicates the outcome through an HTTP status code.',
    references: [
      { label: 'MDN: REST architectural constraints', url: 'https://developer.mozilla.org/en-US/docs/Glossary/REST' },
      { label: 'MDN: HTTP overview and statelessness', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP' },
      { label: 'MDN: HTTP request methods', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods' },
      { label: 'MDN: HTTP response status codes', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status' }
    ]
  },
  {
    id: 'llm-fundamentals',
    categoryId: 'ai-mcp',
    title: 'Understanding LLMs',
    difficulty: 'Beginner',
    learningObjective: 'Explain tokens, context, and next-token generation at a high level.',
    explanation: 'A Large Language Model (LLM) is a neural network trained on large collections of data to process and generate language. Text is represented as tokens, which may be words, parts of words, or symbols. During generation, the model uses the tokens in its context to estimate a distribution over possible next tokens. It selects or samples a token and repeats the process to produce a sequence. This mechanism can create useful responses, but it does not guarantee factual correctness.',
    exampleTitle: 'Example: an AI coding assistant',
    practicalExample: 'When asked to explain a function, a coding assistant uses the prompt and supplied code as context to generate a response. A developer should still inspect the explanation and verify important claims against the code.',
    typingPassage: 'Large language models, or LLMs, are neural networks trained on large collections of data to work with language. Text is split into tokens, which may be words, parts of words, or symbols. During generation, the model uses the tokens in its context to predict a likely next token, then repeats the process to build a response. An AI coding assistant can use a prompt and nearby code as context when explaining a function. Its output can still be incomplete or incorrect, so important results need checking.',
    recallQuestion: 'What is a token, and how does an LLM use context when generating text?',
    expectedAnswer: 'A token is a unit of text representation, such as a word, word fragment, or symbol. An LLM uses the tokens in its available context to predict a likely next token, then repeats that process to generate a sequence. The result may still contain errors.',
    references: [
      { label: 'Microsoft Learn: LLM fundamentals', url: 'https://learn.microsoft.com/en-us/agent-framework/journey/llm-fundamentals' }
    ]
  },
  {
    id: 'mcp-introduction',
    categoryId: 'ai-mcp',
    title: 'Introduction to MCP',
    difficulty: 'Intermediate',
    learningObjective: 'Identify the roles of an MCP host, client, and server, and distinguish tools from resources.',
    explanation: 'The Model Context Protocol (MCP) is an open protocol for connecting AI applications with external context and capabilities through a consistent interface. The host is the application the user interacts with. It manages an MCP client for each server connection, and the client communicates with an MCP server. A server can expose tools that a model may invoke, resources that provide read-only context, and prompt templates. The host remains responsible for the user-facing application and connection management.',
    exampleTitle: 'Example: a coding assistant',
    practicalExample: 'A coding assistant can act as an MCP host and connect to a repository server. The server may expose a read-only resource describing a project and a tool that searches files. The assistant can use those capabilities when answering a developer’s request.',
    typingPassage: 'The Model Context Protocol, or MCP, is an open protocol that lets an AI application connect to external capabilities through a consistent interface. The host is the application the user interacts with. It manages an MCP client for a connection, and that client communicates with an MCP server. A server can expose tools that the model may invoke, resources that provide context, and prompt templates. For example, a coding assistant can connect to a repository server to retrieve project information or run an available tool.',
    recallQuestion: 'What are the roles of an MCP host, client, and server? Give one example of a capability a server can expose.',
    expectedAnswer: 'The host is the AI application the user interacts with. It manages an MCP client, which communicates with an MCP server. The server exposes capabilities such as tools, resources, or prompt templates. A tool might search repository files, while a resource might provide project context.',
    references: [
      { label: 'MCP Python SDK: host, client, server, and primitives', url: 'https://py.sdk.modelcontextprotocol.io/get-started/first-steps/' }
    ]
  }
]);