import React, {useEffect, useState} from 'react';
import axios from 'axios';
import {
    Avatar,
    Box,
    Button,
    Card,
    CardActions,
    CardContent,
    Chip,
    Container,
    Divider,
    FormControl,
    Grid,
    InputLabel,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    MenuItem,
    Paper,
    Select,
    styled,
    Typography
} from "@mui/material";
import {
    PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

function App() {
    const [userId, setUserId] = useState(null);
    const [loggedUser, setLoggedUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [books, setBooks] = useState([]);
    const [recommendations, setRecommendations] = useState([]);
    const [recommendationsWithout, setRecommendationsWithout] = useState([]);

    const selectUser = (event) => {
        setUserId(event.target.value);
        setRecommendations([]);
        setRecommendationsWithout([]);
        setBooks([]);
    };


    const loadUserData = () => {
        setLoggedUser(userId);
        axios.get(`http://localhost:3001/predict/${userId}`).then(res => {
            console.log(res);
            setBooks(res.data.predictions);
            setRecommendations(res.data.recommended);
            setRecommendationsWithout(res.data.recommendedWithout);
            console.log(recommendations);
        });
    }

    const loginCard = <Card sx={{minWidth: 275}}>
        <CardContent>
            <Typography gutterBottom sx={{color: 'text.primary', fontSize: 18}}>
                Login Form
            </Typography>
            <FormControl fullWidth>
                <InputLabel id="demo-simple-select-label">User Id</InputLabel>
                <Select
                    labelId="demo-simple-select-label"
                    id="demo-simple-select"
                    value={userId}
                    label="Selected User"
                    onChange={selectUser}
                >
                    {users.map(item => <MenuItem value={item}>User Id {item}</MenuItem>)}
                </Select>
            </FormControl>
        </CardContent>
        <CardActions>
            <Button onClick={() => loadUserData()} variant="contained" size="small">Access</Button>
        </CardActions>
    </Card>;

    const userCard = <Card sx={{minWidth: 275}}>
        <CardContent>
            <Typography gutterBottom sx={{color: 'text.primary', fontSize: 18}}>
                User {loggedUser}
            </Typography>
        </CardContent>
        <CardActions>
            <Button onClick={() => setLoggedUser(null)} variant="contained" size="small">Logout</Button>
        </CardActions>
    </Card>;

    useEffect(() => {
        axios.get('http://localhost:3001/ratings').then(res => {
            setUsers(res.data.slice(0, 20));
        });
    }, []);


    return (
        <Container maxWidth="lg">
            <div className="p-4">
                <h1 className="text-2xl font-bold mb-4">Cross-Cultural Book Recommender</h1>
                {/*{!userId && <Grid container spacing={2}>
                <Grid size={8}>
                    <Item>size=8</Item>
                </Grid>
                <Grid size={4}>
                    <Item>size=4</Item>
                </Grid>
                <Grid size={4}>
                    <Item>size=4</Item>
                </Grid>
                <Grid size={8}>
                    <Item>size=8</Item>
                </Grid>
            </Grid>}*/}
                {loggedUser &&
                    <div className="grid grid-cols-2 gap-4">
                        <Grid container spacing={2}>
                            <Grid size={12}>
                                {userCard}
                            </Grid>
                                    <Grid size={4}>
                                        <div>My Rated books:</div>
                                        <List sx={{width: '100%', maxWidth: 360, bgcolor: 'background.paper'}}>
                                            {books.map(item => (
                                                <>
                                                    <ListItem alignItems="flex-start">
                                                        <ListItemAvatar>
                                                            <Avatar alt={item.title} src={item.image}
                                                                    sx={{width: 56, height: 56}}/>
                                                        </ListItemAvatar>
                                                        <ListItemText
                                                            sx={{ml: 2}}
                                                            primary={item.title}
                                                            secondary={
                                                                <React.Fragment>
                                                                    <Typography>My Rating: {item.actualRating}</Typography>
                                                                    <Typography>Predicted
                                                                        Rating: {item.predictedRating}</Typography>
                                                                    <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1}}>
                                                                        {[...new Set(item.country?.filter(Boolean))].map((country, idx) => (
                                                                            <Chip key={idx} label={country} size="small"/>
                                                                        ))}
                                                                    </Box>
                                                                </React.Fragment>
                                                            }
                                                        />
                                                    </ListItem>
                                                    <Divider variant="inset" component="li"/>
                                                </>
                                            ))}
                                        </List>
                                    </Grid>
                                    <Grid size={4}>
                                        <div>Recommendations 0.2:</div>
                                        <List sx={{width: '100%', maxWidth: 360, bgcolor: 'background.paper'}}>
                                            {recommendations.map(item => (
                                                <>
                                                    <ListItem alignItems="flex-start">
                                                        <ListItemAvatar>
                                                            <Avatar alt={item.title} src={item.image}
                                                                    sx={{width: 56, height: 56}}/>
                                                        </ListItemAvatar>
                                                        <ListItemText
                                                            sx={{ml: 2}}
                                                            primary={item.title}
                                                            secondary={
                                                                <React.Fragment>
                                                                    <Typography>Predicted Rating: {item.predictedRating}</Typography>
                                                                    <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1}}>
                                                                        {[...new Set(item.country?.filter(Boolean))].map((country, idx) => (
                                                                            <Chip key={idx} label={country} size="small"/>
                                                                        ))}
                                                                    </Box>
                                                                </React.Fragment>
                                                            }
                                                        />
                                                    </ListItem>
                                                    <Divider variant="inset" component="li"/>
                                                </>
                                            ))}
                                        </List>
                                    </Grid>
                                    <Grid size={4}>
                                        <div>Recommendations without diversity:</div>
                                        <List sx={{width: '100%', maxWidth: 360, bgcolor: 'background.paper'}}>
                                            {recommendationsWithout.map(item => (
                                                <>
                                                    <ListItem alignItems="flex-start">
                                                        <ListItemAvatar>
                                                            <Avatar alt={item.title} src={item.image}
                                                                    sx={{width: 56, height: 56}}/>
                                                        </ListItemAvatar>
                                                        <ListItemText
                                                            sx={{ml: 2}}
                                                            primary={item.title}
                                                            secondary={
                                                                <React.Fragment>
                                                                    <Typography>Predicted Rating: {item.predictedRating}</Typography>
                                                                    <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1}}>
                                                                        {[...new Set(item.country?.filter(Boolean))].map((country, idx) => (
                                                                            <Chip key={idx} label={country} size="small"/>
                                                                        ))}
                                                                    </Box>
                                                                </React.Fragment>
                                                            }
                                                        />
                                                    </ListItem>
                                                    <Divider variant="inset" component="li"/>
                                                </>
                                            ))}
                                        </List>
                                    </Grid>
                                </Grid>
                            </Grid>
                            <Grid size={3}>
                                <CountryPieChart/>
                            </Grid>
                        </Grid>
                        {/*<div>
                        <h2 className="font-semibold mb-2">Select book:</h2>
                        <ul>
                            {books.slice(0, 20).map(book => (
                                <li key={book.id}>
                                    <button
                                        onClick={() => handleSelect(book)}
                                        className="text-blue-600 hover:underline"
                                    >
                                        {book.title} — {book.author}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        {selectedBook && (
                            <>
                                <h2 className="font-semibold mb-2">Рекомендации для: {selectedBook.title}</h2>
                                <ul>
                                    {recommendations.map(book => (
                                        <li key={book.id}>{book.title} — {book.author}</li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>*/}
                    </div>}
            </div>
            <Container maxWidth="sm">
                {!loggedUser && loginCard}
            </Container>
        </Container>
    );
}

export default App;