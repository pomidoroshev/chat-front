import React, { Component } from 'react';
import cookie from 'react-cookie';
import logo from './logo.svg';
import update from 'immutability-helper';
import 'whatwg-fetch';
import './App.css';

const URL = 'http://127.0.0.1:8080';
const WS_URL = 'ws://127.0.0.1:8080/ws';


class Authorize extends Component {
  state = {
    login: '',
    password: '',
    errorMessage: ''
  }
  
  errors = {
    400: 'Пустой логин или пароль',
    418: 'Неверный пароль'
  }

  onChangeLogin(e) {
    this.setState(update(this.state, {
      login: {$set: e.target.value}
    }))
  }

  onChangePassword(e) {
    this.setState(update(this.state, {
      password: {$set: e.target.value}
    }))
  }

  onClickAuthorize() {
    fetch(`${URL}/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        login: this.state.login,
        password: this.state.password,
      })
    }).then(resp => {
      this.setState(update(this.state, {
        errorMessage: {$set: ''}
      }));
      if (resp.status === 200) {
        return resp.json();
      } else {
        let message;
        if (resp.status in this.errors) {
          message = this.errors[resp.status];
        } else {
          message = 'Неизвестная ошибка';
        }
        this.setState(update(this.state, {
          errorMessage: {$set: message}
        }))
      }
    }).then(res => {
      if (res) {
        this.props.onAuthorize(res.token);
      }
    })
  }

  render() {
    let error;
    if (this.state.errorMessage.length) {
      error = <p>{this.state.errorMessage}</p>;
    }
    return (
      <div className='auth-form'>
        {error}

        <label>
          Логин:
          <input type="text"
                 value={this.state.login}
                 onChange={this.onChangeLogin.bind(this)} />
        </label>
        <br/>
        <br/>

        <label>
          Пароль:
          <input type="password"
                 id="password"
                 value={this.state.password}
                 onChange={this.onChangePassword.bind(this)} />
        </label>
        <br />

        <button onClick={this.onClickAuthorize.bind(this)}>Войти</button>
      </div>
    );
  }
}


class Chat extends Component {
  state = {
    activeChat: 0,
    chats: [],
    messages: [],
    message: '',
    newChatName: ''
  }

  actionTypes = {
    0: 'Сообщение',
    1: 'Создал чат',
    2: 'Вошел в чат',
    3: 'Вышел из чата'
  }

  ws = null;

  componentDidMount() {
    this.fetchChatList(chats => {
      this.setState(update(this.state, {
        chats: {$set: chats}
      }))
    })
  }

  fetchChatList(callback) {
    fetch(`${URL}/chat/list`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': this.props.token
      }
    }).then(resp => {
      if (resp.status === 200) {
        return resp.json();
      } else {
        this.props.onExpire();
      }
    }).then(chats => {
      callback(chats);
    })
  }

  fetchChatHistory(chatId, lastId, callback) {
    let params = '';
    if (lastId) {
      params = `?last_id=${lastId}`;
    }
    fetch(`${URL}/chat/${chatId}/history${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': this.props.token
      }
    }).then(resp => {
      this.setState(update(this.state, {
        errorMessage: {$set: ''}
      }));
      if (resp.status === 200) {
        return resp.json();
      } else {
        this.props.onExpire();
      }
    }).then(messages => {
      callback(messages);
    })
  }

  loginToChat(chatId, callback) {
    fetch(`${URL}/chat/${chatId}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': this.props.token
      }
    }).then(resp => {
      if (resp.status === 200) {
        return resp.json();
      } else if (resp.status === 401) {
        this.props.onExpire();
      }
    }).then(callback);
  }

  createChat(chatName, callback) {
    fetch(`${URL}/chat/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': this.props.token
      },
      body: JSON.stringify({
        name: chatName
      })
    }).then(resp => {
      if (resp.status === 200) {
        return resp.json();
      } else if (resp.status === 401) {
        this.props.onExpire();
      }
    }).then(callback);
  }

  logoutFromChat(chatId, callback) {
    fetch(`${URL}/chat/${chatId}/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': this.props.token
      }
    }).then(resp => {
      if (resp.status === 200) {
        return resp.json();
      } else if (resp.status === 401) {
        this.props.onExpire();
      }
    }).then(callback);
  }

  onChatClick(chat) {
    console.log(this.ws);
    this.fetchChatHistory(chat.id, null, (messages) => {
      this.setState(update(this.state, {
        messages: {$set: messages},
        activeChat: {$set: chat.id}
      }), () => {
        if (this.ws !== null) {
          this.ws.close();
        }
        this.openWebsocket(chat.id);
      });
    });
  }

  openWebsocket(chatId) {
    let Socket = window.MozWebSocket || WebSocket;
    this.ws = new Socket(`${WS_URL}?id=${chatId}`);

    this.ws.onopen = () => {
      this.ws.send('open');
    };

    this.ws.onmessage = (e) => {
      let message = JSON.parse(e.data);
      this.setState(update(this.state, {
        messages: {$push: [message]}
      }))
    };

  }

  sendMessage(message, chatId, callback) {
    fetch(`${URL}/chat/${chatId}/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': this.props.token
      },
      body: JSON.stringify({
        message: message
      })
    }).then(resp => {
      if (resp.status === 200) {
        return resp.json();
      } else if (resp.status === 401) {
        this.props.onExpire();
      }
    }).then(callback);
  }

  onSendClick() {
    this.sendMessage(this.state.message, this.state.activeChat, (res) => {
      this.setState(update(this.state, {
        message: {$set: ''}
      }));
    })
  }

  onChangeMessage(e) {
    this.setState(update(this.state, {
      message: {$set: e.target.value}
    }))
  }
  
  onLoadMoreClick() {
    let lastId = this.state.messages[0].id;
    this.fetchChatHistory(this.state.activeChat, lastId, (messages) => {
      this.setState(update(this.state, {
        messages: {$unshift: messages}
      }))
    })
  }

  getChatById(id) {
    for (let i = 0; i < this.state.chats.length; i++) {
      if (this.state.chats[i].id === id) {
        return this.state.chats[i];
      }
    }

    return null;
  }

  onLoginClick() {
    this.loginToChat(this.state.activeChat, () => {
      this.getChatById(this.state.activeChat)['user'] = 1;

      this.setState(update(this.state, {
        chats: {$set: this.state.chats.slice(0)}
      }))
    })
  }

  onLogoutClick() {
    this.logoutFromChat(this.state.activeChat, () => {
      this.getChatById(this.state.activeChat)['user'] = null;

      this.setState(update(this.state, {
        chats: {$set: this.state.chats.slice(0)}
      }))
    })
  }

  onNewChatChange(e) {
    this.setState(update(this.state, {
      newChatName: {$set: e.target.value}
    }));
  }

  onNewChatClick() {
    this.createChat(this.state.newChatName, (resp) => {
      this.setState(update(this.state, {
        chats: {$push: [{
          id: resp.id,
          name: this.state.newChatName
        }]},
        newChatName: {$set: ''}
      }))
    });
  }

  render() {
    let chatHistory;
    let bottomBlock;

    if(this.state.activeChat > 0) {
      let chat = this.getChatById(this.state.activeChat);

      if (chat.user !== null) {
        bottomBlock = (
          <div>
            <input type="text"
                  onChange={this.onChangeMessage.bind(this)}
                  value={this.state.message} />
            <button onClick={this.onSendClick.bind(this)}>Отправить</button>
            <br />
            <a style={{
              textDecoration: 'none',
              borderBottom: '1px dashed',
              cursor: 'pointer',
              color: '#0088f5'
            }} onClick={this.onLogoutClick.bind(this)}>Выйти из чата</a>
          </div>
        );
      } else {
        bottomBlock = (
          <a style={{
            textDecoration: 'none',
            borderBottom: '1px dashed',
            cursor: 'pointer',
            color: '#0088f5'
          }} onClick={this.onLoginClick.bind(this)}>Войти в чат</a>
        );
      }
    }
    let loadMore;
    if (this.state.messages.length > 0) {
      loadMore = (
        <button onClick={this.onLoadMoreClick.bind(this)}>
          Загрузить ещё
        </button>
      );
    }
    chatHistory = (
      <div className="chat-history">
          {loadMore}
          <ul>
            {this.state.messages.map((el, i) => {
              let message = <span className='chat-message'>{el.message}</span>;
              if (el.action_type > 0) {
                message = (
                  <span className='chat-message chat-message-action'>
                    {this.actionTypes[el.action_type]}
                  </span>
                );
              }
              return (
                <li key={i}>
                  <span className='chat-login'>{el.login}</span>
                  {message}
                  <span className='chat-datetime'>{el.datetime}</span>
                </li>
              )
            })}
          </ul>

          {bottomBlock}
      </div>
    );

    return (
      <div>
        <div className="chat-list">
          <ul>
            {this.state.chats.map((el, i) => {
              let style = {};
              let className = '';

              if (el.id === this.state.activeChat) {
                className = 'selected';
              }
              return (
                <li key={i}
                    style={style}
                    className={className}
                    onClick={this.onChatClick.bind(this, el)}>
                  {el.name} {el.user !== null ? '+' : ''}
                </li>
              )
            })}
          </ul>
          <div className='create-chat'>
            <input type='text'
                   value={this.state.newChatName}
                   placeholder='Название чата'
                   onChange={this.onNewChatChange.bind(this)} />
            <br/>
            <button onClick={this.onNewChatClick.bind(this)}>
              Создать чат
            </button>
          </div>
        </div>
        {chatHistory}
      </div>
    );
  }
}


class App extends Component {
  state = {
    token: ''
  }

  componentDidMount() {
    let token = cookie.load('token');
    if (token === undefined) {
      this.setState({
        token: ''
      });
    } else {
      this.setState({
        token: token
      });
    }
  }

  onAuthorize(token) {
    let expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);

    cookie.save('token', token, {
      expires: expirationDate
    });

    this.setState({
      token: token
    });
  }

  onExpire() {
    this.setState({
      token: ''
    });
  }

  render() {
    let body;
    if(this.state.token.length > 0) {
      body = <Chat token={this.state.token}
                   onExpire={this.onExpire.bind(this)} />;
    } else {
      body = <Authorize onAuthorize={this.onAuthorize.bind(this)} />;
    }

    return (
      <div className="App">
        <div className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h2>Чатики</h2>
        </div>
        <div className="content">
          {body}
        </div>
      </div>
    );
  }
}

export default App;
