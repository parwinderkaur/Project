"use strict";
const moment =require('moment');
const User = use("App/Models/User");
const UserProfile = use("App/Models/UserProfile");
const Affiliate = use('App/Models/Affiliate');
const University = use('App/Models/UniversityMaster');
const ChannelPartner = use('App/Models/ChannelPartner');
const Partner =use('App/Models/Partner');
const Helper = use('App/utils/Helper')
const CloudStorageModel = use("App/Models/CloudStorage");
const AssetsMasterModel = use("App/Models/AssetsMaster");
const Appointment = use("App/Models/Appointment");
const UserSubscription = use("App/Models/UserSubscription");
const UserYoutubeVideo = use("App/Models/UserYoutubeVideo");
const InterestMaster = use("App/Models/InterestMaster");
const UserInterest = use("App/Models/UserInterest");
const Addon = use("App/Models/UserAddOn");
const _ = require("lodash");
const Mentor = use("App/Models/Mentor");
const Order = use("App/Models/Order");
const BaseController = use('App/Controllers/Http/BaseController')
const SubscriptionPlans = use("App/Models/SubscriptionPlan");
const YoutubeVideo = use('App/Models/YoutubeVideo');
const PaymentGatewayModel = use('App/Models/PaymentGateway');
const UserAuthentication = use('App/Models/UserAuthentication');
const Transactions = use("App/Models/Transaction");
const Event = use('Event')
const Database = use('Database');
const UserExperience = use('App/Models/UserExperience');
const UserAchievement = use('App/Models/UserAchievement');
const UserTestimonial = use('App/Models/UserTestimonial');
const MentorCountryOrg = use('App/Models/MentorCountryOrg');
const csv = require('@fast-csv/parse');

class AdminController extends BaseController {
  async adminUser({ request, response, auth }) {
    let rules = {
      username: "required|unique:users",
      mobile_no: "required|number|min:7|max:15|unique:users",
      email: "required|email|unique:users",
      password: "min:6",
      password_confirmation: "same:password",
      user_type: "required|in:MENTOR,MENTEE",
      first_name: "required",
      last_name: "string",
      designation: "string",
      referal_code: "string",
      user_category: "required|in:STUDENT,ENTREPRENEUR,PROFESSIONAL",
      gender: "required|in:MALE,FEMALE,OTHERS",
      date_of_birth: "string",
      common_address_line_1: "string",
      common_address_line_2: "string",
      common_city: "string",
      common_state: "string",
      common_pin: "string",
      common_country: "string",
      user_status: "string",
      created_by: "string",
      deleted_by: "string",
      modified_by: "string",
      highest_education: "string",
      passing_year: "string",
      institute: "string",
      country: "string",
      "2nd_highest_education": "string",
      "2nd_institution": "string",
      "2nd_country": "string",
      no_of_year_work_exp: "number",
      company_name: "string",
      no_of_year_mentorship_exp: "number",
      mentor_area_of_experties: "string",
      mentor_cv: "string",
      maritial_status: "in:MARRIED,UNMARRIED",
      pincode: "integer|max:6",
      university_name: "string",
      stream: "in:ART,SCIENCE,COMMERCE",
      average_availability: "string",
      industry: "string",
      current_position: "string",
      about:'string',
      country_id: 'required',
      org_id: 'required',
      organisation: 'required',
      skills: "string"
    };
    const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        
    const data = request.only([
      "username",
      "mobile_no",
      "email",
      "password",
      "designation",
      "user_type",
      "first_name",
      "last_name",
      "referal_code",
      "user_category",
      "gender",
      "profile_image",
      "date_of_birth",
      "user_type",
      "common_country",
      "common_address_line_1",
      "common_address_line_2",
      "common_city",
      "common_state",
      "common_pin",
      "linked_in",
      "about",
      "country_id",
      "org_id",
      "organisation",
      "skills"
    ]);
   
    const inputs = request.only([
      "maritial_status",
      "pincode",
      "university_name",
      "highest_education",
      "passing_year",
      "institute",
      "country",
      "2nd_highest_education",
      "2nd_institution",
      "2nd_country",
      "no_of_year_work_exp",
      "company_name",
      "area_of_experties",
      "no_of_year_mentorship_exp",
      "mentor_area_of_experties",
      "mentor_cv",
      "stream",
      "average_availability",
      "industry",
      "current_position"
    ]);
    if (request.input("country_id")) {
      let country = await Database.select('name').from('country').where( 'id',request.input("country_id"));
      data['common_country']=country[0].name;
      inputs['country']=country[0].name;
    }
    let mobile_verified = request.only(["mobile_verified"]);
    if (mobile_verified.mobile_verified == "on") {
      data.mobile_verified = 1;
    } else {
      data.mobile_verified = 0;
    }

    let _t = request.input('area_of_experties');
    if(!Array.isArray(_t)){
      _t = [_t]
    } 
    inputs['area_of_experties'] = _t.join();
   
    // console.log(data);
    let userDetail = await User.create(data);
    if (request.input('user_type') === 'MENTOR'){
      Event.emit('new::user', userDetail);
    }
    inputs.user_id = userDetail.id;
    let userprofile = await UserProfile.create(inputs);
    // console.log("wor434");
    return response.status(200).send({
      status: true,
      message: "User created successfully",
      data: {
        userDetail,
        userprofile
      }
    });
  }

  async getUsers({ request, response, auth }) {
    var users = await User.query()
      .whereNot({'user_type': 'ADMIN'})
        .select('id','user_type','email','first_name','last_name','gender','user_category','last_login_at','last_otp','subscription_plan_id',
            'user_interest', 'country_id','deleted_by','sequence','created_at','user_categories','provider','mobile_no','common_city','organisation')
        .with('mentor.accessType')
      .withTrashed()
        .orderBy('sequence', 'asc')
      .fetch();
    return response.status(200).send({
      status: true,
      message: "List of all users",
      data: users
    });
  }
  async getUserProfile({request, response, auth}) {
    let inputs = request.all();
    let Search=inputs.search || null;let Page=inputs.offset || 1;let Filter=inputs.filter || null;
    let Limit=inputs.limit || 10;let Sort_By=inputs.sort||'sequence';let Order_by=inputs.order||'asc';
    Filter=(Filter !== 'undefined') ? JSON.parse(Filter) : null;
    let UtmMedium=inputs.utm_medium || null;let userIds=[];
    if(UtmMedium != 'null') userIds = await Helper.getAdminleadUsersId(UtmMedium);
    await User.query()
        .whereNot({'user_type': 'ADMIN'})
        .select('id','first_name','last_name', 'mobile_no','alt_mobile_no', 'email','skills',
            'date_of_birth', 'gender', 'about','common_address_line_1','profile_image','user_type')
        .with('userInterest').with('user_certification').with('user_education').with('user_achievement').with('user_project')
        .with('user_experiences').with('user_startup').with('user_startup_category').with('position_of_responsibility')
        .withTrashed()
        .where((query) => {
          if (UtmMedium != 'null'){
            query.whereIn('id',userIds)
          }
          if (Filter){
            query.andWhere(q => {
              if (Filter.user_type){ q.andWhere('user_type',Filter.user_type) }
            })
          }
          if(Search){
            query.andWhere(q => {
              q.orWhere('id', 'like', '%' + Search + '%').orWhere('email', 'like', '%' + Search + '%')
                  .orWhere('first_name', 'like', '%' + Search + '%').orWhere('last_name', 'like', '%' + Search + '%')
                  .orWhere('mobile_no', 'like', '%' + Search + '%').orWhere('alt_mobile_no', 'like', '%' + Search + '%')
                  .orWhere('date_of_birth', 'like', '%' + Search + '%').orWhere('gender', 'like', '%' + Search + '%')
                  .orWhere('about', 'like', '%' + Search + '%').orWhere('common_address_line_1', 'like', '%' + Search + '%')
                  .orWhere('user_type', 'like', '%' + Search + '%')
            })
          }
        }).orderBy(Sort_By, Order_by)
        .paginate(Page/Limit+1,Limit)
        .then(result => {
          result=result.toJSON();
          let data={
            "rows":result.data,
            "total":result.total,
            "totalNotFiltered":result.total
          }
          return response.status(200).send({
            status: true,
            message: "Pagination List of all users with filter",
            data: data
          });
        })
        .catch(err => {
          return response.status(400).json({
            status: false,
            message: "something went wrong",
            error: err,
          })
        })
  }
  async getUserProfileById({ request, response, auth,params }) {
    let users = await User.query()
        .whereNot({'user_type': 'ADMIN'})
        .where('id',params.id)
        .with('userInterest').with('user_certification', (data) => {
          data.orderBy('expiration_date', 'desc')
        }).with('user_education', (data) => {
          data.orderBy('end_date', 'desc')
        }).with('user_achievement', (data) => {
          data.orderBy('issue_date', 'desc')
        }).with('user_project').with('user_experiences', (data) => {
          data.orderBy('end_date', 'desc')
        }).with('user_startup').with('user_startup_category').with('position_of_responsibility', (data) => {
          data.orderBy('end_date', 'desc')
        }).fetch();
    users=users.toJSON();
    users=(users.length) ? users[0] : users
    users.userInterestIds = _.map(users.userInterest, "master_interest_id");
    users.skills=(users.skills) ? users.skills.split(",") : null;
    if (users.user_experiences && users.user_experiences.length != 0){
      users.user_experiences = users.user_experiences.map((item) => {
        if (item.end_date) users.current_experiences= item.title;
        item.exp_start_date=moment(item.start_date).format('YYYY-MM-DD')
        item.exp_end_date=moment(item.end_date).format('YYYY-MM-DD')
        item.start_date=moment(item.start_date).format("YYYY")
        item.end_date=moment(item.end_date).format("YYYY")
        return item;
      });
    }
    if (users.position_of_responsibility && users.position_of_responsibility.length != 0){
      users.position_of_responsibility = users.position_of_responsibility.map((item) => {
        item.p_o_r_start_date=moment(item.start_date).format('YYYY-MM-DD')
        item.p_o_r_end_date=moment(item.end_date).format('YYYY-MM-DD')
        item.start_date=moment(item.start_date).format("YYYY")
        item.end_date=moment(item.end_date).format("YYYY")
        return item;
      });
    }
    if (users.user_achievement && users.user_achievement.length != 0){
      users.user_achievement = users.user_achievement.map((item) => {
        item.achiv_issue_date=moment(item.issue_date).format('YYYY-MM-DD')
        item.issue_date=moment(item.issue_date).format("YYYY")
        return item;
      });
    }
    if (users.user_education && users.user_education.length != 0){
      users.user_education = users.user_education.map((item) => {
        item.edu_start_date=moment(item.start_date).format('YYYY-MM-DD')
        item.edu_end_date=moment(item.end_date).format('YYYY-MM-DD')
        item.start_date=moment(item.start_date).format("YYYY")
        item.end_date=moment(item.end_date).format("YYYY")
        return item;
      });
    }
    if (users.user_certification && users.user_certification.length != 0){
      users.user_certification = users.user_certification.map((item) => {
        item.certi_issue_date=moment(item.issue_date).format('YYYY-MM-DD')
        item.certi_expiration_date=moment(item.expiration_date).format('YYYY-MM-DD')
        item.issue_date=moment(item.issue_date).format("YYYY")
        item.expiration_date=moment(item.expiration_date).format("YYYY")
        return item;
      });
    }
    return response.status(200).send({
      status: true,
      message: "List of all users",
      data: users
    });
  }

  async getMentorList({ request, response, auth }) {
    let inputs = request.all();
    let Search=inputs.search || null;let Page=inputs.offset || 1;let Limit=inputs.limit || 10;
    await User.query()
        .select('id','email','first_name','last_name','mobile_no','user_categories')
        .with('mentor.accessType')
        .withTrashed()
        .where((query) => {
          query.where('user_type', 'MENTOR')
          if(Search){
            query.andWhere(q => {
              q.orWhere('id', 'like', '%' + Search + '%')
                  .orWhere('email', 'like', '%' + Search + '%')
                  .orWhere('first_name', 'like', '%' + Search + '%')
                  .orWhere('last_name', 'like', '%' + Search + '%')
                  .orWhere('mobile_no', 'like', '%' + Search + '%')
            })
          }
        }).orderBy('sequence', 'asc')
        .paginate(Page/Limit+1,Limit)
        .then(result => {
          result=result.toJSON();
          return response.status(200).send({
            status: true,
            message: "Pagination List of all mentor",
            data: {
              "rows":result.data,
              "total":result.total,
              "totalNotFiltered":result.total
            }
          });
        })
        .catch(err => {
          return response.status(400).json({
            status: false,
            message: "something went wrong",
            error: err,
          })
        })
  }
  async getMentorAvailabilityList({ request, response, auth }) {
    let inputs = request.all();
    let Search=inputs.search || null;let Page=inputs.offset || 1;let Limit=inputs.limit || 10;
    await User.query().select('id','first_name','last_name')
        .with('mentor_calendar',(data)=>{
          data.where('available_date','>=',moment().format('YYYY-MM-DD'))
        })
        .where((query) => {
          query.where('user_type', 'MENTOR')
          if(Search){
            query.andWhere(q => {
              q.orWhere('id', 'like', '%' + Search + '%').orWhere('first_name', 'like', '%' + Search + '%')
                  .orWhere('last_name', 'like', '%' + Search + '%')
            })
          }
        }).orderBy('id', 'asc')
        .paginate(Page/Limit+1,Limit)
        .then(result => {
          result=result.toJSON();
          return response.status(200).send({
            status: true,
            message: "Pagination List of all mentor",
            data: {
              "rows":result.data,
              "total":result.total,
              "totalNotFiltered":result.total
            }
          });
        })
        .catch(err => {
          return response.status(400).json({
            status: false,
            message: "something went wrong",
            error: err,
          })
        })
  }
  async getUsersOtp({ request, response, auth }) {
    let users = await UserAuthentication.query().fetch();
    return response.status(200).send({
      status: true,
      message: "List of all users OTP",
      data: users
    });
  }
  async getUsersOtpList({ request, response, auth }) {
    let inputs = request.all();
    let Search=inputs.search || null;let Page=inputs.offset || 1;
    let Limit=inputs.limit || 10;let Sort_By=inputs.sort||'id';let Order_by=inputs.order||'asc';
    await UserAuthentication.query()
        .select('id','user_id','email','is_email_verified','mobile_no','is_mobile_verified','otp','otp_expiry','created_at','updated_at')
        .where((query) => {
          if(Search){
            query.andWhere(q => {
              q.orWhere('id', 'like', '%' + Search + '%')
                  .orWhere('user_id', 'like', '%' + Search + '%')
                  .orWhere('email', 'like', '%' + Search + '%')
                  .orWhere('is_email_verified', 'like', '%' + Search + '%')
                  .orWhere('mobile_no', 'like', '%' + Search + '%')
                  .orWhere('is_mobile_verified', 'like', '%' + Search + '%')
                  .orWhere('otp', 'like', '%' + Search + '%')
                  .orWhere('otp_expiry', 'like', '%' + Search + '%')
                  .orWhere('created_at', 'like', '%' + Search + '%')
                  .orWhere('updated_at', 'like', '%' + Search + '%')
            })
          }
        }).orderBy(Sort_By, Order_by)
        .paginate(Page/Limit+1,Limit)
        .then(result => {
          result=result.toJSON();
          let data={
            "rows":result.data,
            "total":result.total,
            "totalNotFiltered":result.total
          }
          return response.status(200).send({
            status: true,
            message: "Pagination List of all users OTP with filter",
            data: data
          });
        })
        .catch(err => {
          return response.status(400).json({
            status: false,
            message: "something went wrong",
            error: err,
          })
        })
  }
  async mentorList({ request, response, auth }) {
    let MentorList = await User.query()
      .where('user_type','MENTOR').select('id','email').orderBy('sequence', 'asc').fetch();
    return response.status(200).send({
      status: true,
      message: "Admin mentor list",
      data: MentorList
    });
  }
  async menteeList({ request, response, auth }) {
    let MenteeList = await User.query()
        .where('user_type','MENTEE').select('id','email').orderBy('sequence', 'asc').fetch();
    return response.status(200).send({
      status: true,
      message: "Admin Mentee list",
      data: MenteeList
    });
  }
  async getUsersList({ request, response }) {
    let inputs = request.all();
    let Search=inputs.search || null;let Page=inputs.offset || 1;let Filter=inputs.filter || null;
    let Limit=inputs.limit || 10;let Sort_By=inputs.sort||'sequence';let Order_by=inputs.order||'asc';
    Filter=(Filter !== 'undefined') ? JSON.parse(Filter) : null;
    let UtmMedium=inputs.utm_medium || null;let userIds=[];
    if(UtmMedium != 'null') userIds = await Helper.getAdminleadUsersId(UtmMedium);
    await User.query()
        .whereNot({'user_type': 'ADMIN'})
        .select('id','user_type','email','first_name','last_name','gender','user_category','last_login_at','last_otp','subscription_plan_id',
            'user_interest', 'country_id','deleted_by','sequence','created_at','user_categories','provider','mobile_no','common_city','organisation')
        .with('mentor.accessType').withTrashed()
        .where((query) => {
          if (UtmMedium != 'null'){
            query.whereIn('id',userIds)
          }
          if (Filter){
            query.andWhere(q => {
              if (Filter.user_type){ q.andWhere('user_type',Filter.user_type) }
              if (Filter.user_category){ q.andWhere('user_category', Filter.user_category) }
              if (Filter.organisation){ q.andWhere('organisation', Filter.organisation) }
            })
          }
          if(Search){
            query.andWhere(q => {
              q.orWhere('id', 'like', '%' + Search + '%')
                  .orWhere('user_type', 'like', '%' + Search + '%')
                  .orWhere('email', 'like', '%' + Search + '%')
                  .orWhere('first_name', 'like', '%' + Search + '%')
                  .orWhere('last_name', 'like', '%' + Search + '%')
                  .orWhere('gender', 'like', '%' + Search + '%')
                  .orWhere('user_category', 'like', '%' + Search + '%')
                  .orWhere('last_login_at', 'like', '%' + Search + '%')
                  .orWhere('last_otp', 'like', '%' + Search + '%')
                  .orWhere('subscription_plan_id', 'like', '%' + Search + '%')
                  .orWhere('user_interest', 'like', '%' + Search + '%')
                  .orWhere('country_id', 'like', '%' + Search + '%')
                  .orWhere('deleted_by', 'like', '%' + Search + '%')
                  .orWhere('sequence', 'like', '%' + Search + '%')
                  .orWhere('created_at', 'like', '%' + Search + '%')
                  .orWhere('user_categories', 'like', '%' + Search + '%')
                  .orWhere('provider', 'like', '%' + Search + '%')
                  .orWhere('mobile_no', 'like', '%' + Search + '%')
                  .orWhere('common_city', 'like', '%' + Search + '%')
                  .orWhere('organisation', 'like', '%' + Search + '%')
            })
          }
        }).orderBy(Sort_By, Order_by)
    .paginate(Page/Limit+1,Limit)
    .then(result => {
      result=result.toJSON();
      let data={
        "rows":result.data,
        "total":result.total,
        "totalNotFiltered":result.total
      }
      return response.status(200).send({
        status: true,
        message: "Pagination List of all users with filter",
        data: data
      });
    })
    .catch(err => {
      return response.status(400).json({
        status: false,
        message: "something went wrong",
        error: err,
      })
    })
  }
  async getUserWithId({ request, response, auth, params }) {
    var user = await User.findBy({ id: params.id });
    var userProf = await UserProfile.findBy({ user_id: user.id });
    await user.load("userInterest");
    user = user.toJSON();
    user.userInterestIds = _.map(user.userInterest, "master_interest_id");
    user.userprofile = userProf;
    return response.status(200).send({
      status: true,
      message: "user and its profile",
      data: user
    });
  }

  async updateAdminUser({ request, response, auth, params }) {
    let rules = {
      user_category: "required|in:STUDENT,ENTREPRENEUR,PROFESSIONAL",
      date_of_birth: "string",
      common_address_line_1: "string",
      common_address_line_2: "string",
      common_city: "string",
      common_state: "string",
      common_pin: "string",
      common_country: "string",
      user_status: "string",
      designation: "string",
      created_by: "string",
      deleted_by: "string",
      modified_by: "string",
      highest_education: "string",
      passing_year: "string",
      institute: "string",
      country: "string",
      country_id: "required",
      "2nd_highest_education": "string",
      "2nd_institution": "string",
      "2nd_country": "string",
      no_of_year_work_exp: "number",
      company_name: "string",
      no_of_year_mentorship_exp: "number",
      mentor_area_of_experties: "string",
      mentor_cv: "string",
      maritial_status: "in:MARRIED,UNMARRIED",
      pincode: "integer|max:6",
      university_name: "string",
      stream: "in:ART,SCIENCE,COMMERCE",
      average_availability: "string",
      industry: "string",
      current_position: "string",
      mobile_verified:'number',
      mobile_no:'number',
      about:'string',
      organisation: "string",
      mentor_access: "string",
      organisation_access: "string",
      org_id: "string",
      skills: "string"
    };

    const validation = await this.validate(request, response, rules);
    if (validation.fails()) {
        return response.status(422).send({
            status: false,
            message: validation.messages()[0].message,
            hint: validation.messages()
        })
    }

    const UserProfile = use("App/Models/UserProfile");

    const data = request.only([
      "user_category",
      "mobile_no",
      "gender",
      "profile_image",
      "designation",
      "date_of_birth",
      "user_type",
      "common_country",
      "common_address_line_1",
      "common_address_line_2",
      "common_city",
      "common_state",
      "common_pin",
      "linked_in",
      "created_by",
      "deleted_by",
      'mobile_verified',
      'about',
      "organisation",
      "mentor_access",
      "organisation_access",
      "org_id",
      "skills"
    ]);

    const inputs = request.only([
      "maritial_status",
      "pincode",
      "university_name",
      "highest_education",
      "passing_year",
      "institute",
      "country",
      "2nd_highest_education",
      "2nd_institution",
      "2nd_country",
      "no_of_year_work_exp",
      "company_name",
      "area_of_experties",
      "no_of_year_mentorship_exp",
      "mentor_area_of_experties",
      "mentor_cv",
      "stream",
      "average_availability",
      "industry",
      "current_position"
    ]);
    if (request.input("country_id")) {
      let country = await Database.select('name').from('country').where( 'id',request.input("country_id"));
      data['common_country']=country[0].name;
      inputs['country']=country[0].name;
    }
    inputs.user_id = params.id;

    let _t = request.input('area_of_experties');
    if(!Array.isArray(_t)){
      _t = [_t]
    } 
    inputs['area_of_experties'] = _t.join();

    var userDetail = await User.query()
      .where({ id: params.id })
      .update(data);
    var userprofile = await UserProfile.query()
      .where({ user_id: params.id })
      .update(inputs);

    return response.status(200).send({
      status: true,
      message: "User detail updated successfully",
      data: {
        userDetail
      }
    });
  }

  async getCloudStorageFiles({ request, response }) {
    var data = await CloudStorageModel.all();
    return response.status(200).send({
      status: true,
      data: data
    });
  }
  async getCloudStorageFilesList({ request, response }) {
    let inputs = request.all();
    let Search=inputs.search || null;let Page=inputs.offset || 1;let Limit=inputs.limit || 10;
    await CloudStorageModel.query()
        .select('id','file_name','hash','provider','deleted_at')
        .where((query) => {
          if(Search){
            query.andWhere(q => {
              q.orWhere('id', 'like', '%' + Search + '%')
                  .orWhere('file_name', 'like', '%' + Search + '%')
                  .orWhere('hash', 'like', '%' + Search + '%')
                  .orWhere('provider', 'like', '%' + Search + '%')
                  .orWhere('deleted_at', 'like', '%' + Search + '%')
            })
          }
        })
        .paginate(Page/Limit+1,Limit)
        .then(result => {
          result=result.toJSON();
          return response.status(200).send({
            status: true,
            message: "Pagination List of all users with filter",
            data: {
              "rows":result.data,
              "total":result.total,
              "totalNotFiltered":result.total
            }
          });
        })
        .catch(err => {
          return response.status(400).json({
            status: false,
            message: "something went wrong",
            error: err,
          })
        })
  }

  async getAssetList({ request, response }) {
    var data = await AssetsMasterModel.all();
    data = data.toJSON();
    data = _.uniqBy(data, "asset_name");
    return response.status(200).send({
      status: true,
      data: data
    });
  }
  async getAssetLists({ request, response }) {
    let inputs = request.all();
    let Search=inputs.search || null;let Page=inputs.offset || 1;let Limit=inputs.limit || 10;
    await AssetsMasterModel.query()
        .select('id','asset_name','asset_description','asset_type','asset_owner','asset_url','thumbnail_url','access_level','price','discount_percentage',
            'subscription_discount')
        .where((query) => {
          if(Search){
            query.andWhere(q => {
              q.orWhere('id', 'like', '%' + Search + '%')
                  .orWhere('asset_name', 'like', '%' + Search + '%')
                  .orWhere('asset_description', 'like', '%' + Search + '%')
                  .orWhere('asset_type', 'like', '%' + Search + '%')
                  .orWhere('asset_owner', 'like', '%' + Search + '%')
                  .orWhere('asset_url', 'like', '%' + Search + '%')
                  .orWhere('thumbnail_url', 'like', '%' + Search + '%')
                  .orWhere('access_level', 'like', '%' + Search + '%')
                  .orWhere('price', 'like', '%' + Search + '%')
                  .orWhere('discount_percentage', 'like', '%' + Search + '%')
                  .orWhere('subscription_discount', 'like', '%' + Search + '%')
            })
          }
        })
        .paginate(Page/Limit+1,Limit)
        .then(result => {
          result=result.toJSON();
          result.data = _.uniqBy(result.data, "asset_name");
          return response.status(200).send({
            status: true,
            message: "Pagination List of all users with filter",
            data: {
              "rows":result.data,
              "total":result.total,
              "totalNotFiltered":result.total
            }
          });
        })
        .catch(err => {
          return response.status(400).json({
            status: false,
            message: "something went wrong",
            error: err,
          })
        })
  }

  async getAppointment({ request, response }) {
    var data = await Appointment.query()
      .with("menteeUser")
      .with("mentorUser")
      .fetch();
    return data;
  }

  async delete({ request, response, params }) {
    var user = await User.findBy({ id: params.id });
    var userprofile = await UserProfile.findBy({ user_id: params.id });

    if (!user) {
      return response.status(400).send({
        status: false,
        message: "User not found"
      });
    }

    await user.delete();
    await userprofile.delete();

    return response.status(200).send({
      status: true,
      message: "User deleted",
      data: user
    });
  }

  async orders({ request, response }) {
    let data = await Order.query()
        .with("asset")
        .with("user")
        .fetch();

    return response.status(200).send({
      status: true,
      message: "Orders",
      data: data
    });
  }
  async ordersList({ request, response }) {
    let inputs = request.all();
    let Search=inputs.search || null;let Page=inputs.offset || 1;
    let Limit=inputs.limit || 10;let Sort_By=inputs.sort||'id';let Order_by=inputs.order||'asc';
    await Order.query()
        .select('id','user_id','type','type_id','amount','currency','status','gateway_transaction_id', 'gateway_payment_id', 'discount_amount',
            'discount_code')
        .where((query) => {
          if(Search){
            query.andWhere(q => {
              q.orWhere('id', 'like', '%' + Search + '%')
                  .orWhere('user_id', 'like', '%' + Search + '%')
                  .orWhere('type', 'like', '%' + Search + '%')
                  .orWhere('type_id', 'like', '%' + Search + '%')
                  .orWhere('amount', 'like', '%' + Search + '%')
                  .orWhere('currency', 'like', '%' + Search + '%')
                  .orWhere('status', 'like', '%' + Search + '%')
                  .orWhere('gateway_transaction_id', 'like', '%' + Search + '%')
                  .orWhere('gateway_payment_id', 'like', '%' + Search + '%')
                  .orWhere('discount_amount', 'like', '%' + Search + '%')
                  .orWhere('discount_code', 'like', '%' + Search + '%')
            })
          }
        }).orderBy(Sort_By, Order_by)
        .paginate(Page/Limit+1,Limit)
        .then(result => {
          result=result.toJSON();
          return response.status(200).send({
            status: true,
            message: "Pagination List of all Orders with filter",
            data: {
              "rows":result.data,
              "total":result.total,
              "totalNotFiltered":result.total
            }
          });
        })
        .catch(err => {
          return response.status(400).json({
            status: false,
            message: "something went wrong",
            error: err,
          })
        })
  }

  async transactions({ request, response }) {
    let data = await Transactions.query().fetch();
    return response.status(200).send({
      status: true,
      message: "Transactions",
      data: data
    });
  }
  async transactionsList({ request, response }) {
    let inputs = request.all();
    let Search=inputs.search || null;let Page=inputs.offset || 1;
    let Limit=inputs.limit || 10;let Sort_By=inputs.sort||'id';let Order_by=inputs.order||'asc';
    await Transactions.query()
        .select('id','user_id','type','type_id','order_id','amount','currency','gateway','gateway_transaction_id')
        .where((query) => {
          if(Search){
            query.andWhere(q => {
              q.orWhere('id', 'like', '%' + Search + '%')
                  .orWhere('user_id', 'like', '%' + Search + '%')
                  .orWhere('type', 'like', '%' + Search + '%')
                  .orWhere('type_id', 'like', '%' + Search + '%')
                  .orWhere('order_id', 'like', '%' + Search + '%')
                  .orWhere('amount', 'like', '%' + Search + '%')
                  .orWhere('currency', 'like', '%' + Search + '%')
                  .orWhere('gateway', 'like', '%' + Search + '%')
                  .orWhere('gateway_transaction_id', 'like', '%' + Search + '%')
            })
          }
        }).orderBy(Sort_By, Order_by)
        .paginate(Page/Limit+1,Limit)
        .then(result => {
          result=result.toJSON();
          return response.status(200).send({
            status: true,
            message: "Pagination List of all Transactions with filter",
            data: {
              "rows":result.data,
              "total":result.total,
              "totalNotFiltered":result.total
            }
          });
        })
        .catch(err => {
          return response.status(400).json({
            status: false,
            message: "something went wrong",
            error: err,
          })
        })
  }

  async addOns({ request, response }) {
    const Addon = use("App/Models/UserAddOn");

    let data = await Addon.query().fetch();

    return response.status(200).send({
      status: true,
      message: "Addons",
      data: data
    });
  }
  async addOnsList({ request, response }) {
    let inputs = request.all();
    let Search=inputs.search || null;let Page=inputs.offset || 1;let Limit=inputs.limit || 10;
    await Addon.query()
        .select('id','user_id','transaction_id','order_id')
        .where((query) => {
          if(Search){
            query.andWhere(q => {
              q.orWhere('id', 'like', '%' + Search + '%')
                  .orWhere('user_id', 'like', '%' + Search + '%')
                  .orWhere('transaction_id', 'like', '%' + Search + '%')
                  .orWhere('order_id', 'like', '%' + Search + '%')
            })
          }
        })
        .paginate(Page/Limit+1,Limit)
        .then(result => {
          result=result.toJSON();
          return response.status(200).send({
            status: true,
            message: "Pagination List of all Addons",
            data: {
              "rows":result.data,
              "total":result.total,
              "totalNotFiltered":result.total
            }
          });
        })
        .catch(err => {
          return response.status(400).json({
            status: false,
            message: "something went wrong",
            error: err,
          })
        })
  }

  async appointments({ request, response }) {

    let data = await Appointment.query()
      .with("menteeUser")
      .with("mentorUser")
      .with('callDetails')
      .fetch();

    return response.status(200).send({
      status: true,
      message: "Appointments",
      data: data
    });
  }
  async appointmentsList({ request, response }) {
    let inputs = request.all();
    let Search=inputs.search || null;let Page=inputs.offset || 1;let Filter=inputs.filter || null;
    let Limit=inputs.limit || 10;let Sort_By=inputs.sort||'id';let Order_by=inputs.order||'asc';
    Filter=(Filter !== 'undefined') ? JSON.parse(Filter) : null;
    await Appointment.query()
        .leftJoin('users as mentor', 'appointments.mentor_id', 'mentor.id')
        .leftJoin('users as mentee', 'appointments.mentee_id', 'mentee.id')
        .leftJoin('users as reschedule', 'appointments.rescheduled_by', 'reschedule.id')
        .with('callDetails',(q)=>{
          q.select('id as appo_id','appointment_id','mentee_number','mentor_number','status','channel','channel_call_id','time_seconds'
              ,'time_minutes','start_time','end_time','channel_response','created_at')
        })
        .select('appointments.id','date','from','to','status','transaction_id','order_id','price','call_duration','feedback', 'rating','rescheduled_by'
            ,'mentor.id as mentor_id','mentor.first_name as mentor_first_name','mentor.last_name as mentor_last_name'
            ,'mentor.mobile_no as mentor_mobile_no','mentee.id as mentee_id','reschedule.email as rescheduled_by_email','mentee.first_name as mentee_first_name',
            'mentee.last_name as mentee_last_name', 'mentee.mobile_no as mentee_mobile_no','mentor.email as mentor_email','mentee.email as mentee_email'
            ,'mentee.organisation as mentee_organisation','appointments.expectation')
        .where((query) => {
          if (Filter){
            query.andWhere(q => {
              if (Filter.mentee_organisation){ q.andWhere('mentee.organisation',Filter.mentee_organisation) }
              if (Filter.status){ q.andWhere('status',Filter.status) }
            })
          }
          if(Search){
            query.andWhere(q => {
              q.orWhere('appointments.id', 'like', '%' + Search + '%').orWhere('date', 'like', '%' + Search + '%')
                  .orWhere('from', 'like', '%' + Search + '%').orWhere('to', 'like', '%' + Search + '%')
                  .orWhere('status', 'like', '%' + Search + '%').orWhere('transaction_id', 'like', '%' + Search + '%')
                  .orWhere('order_id', 'like', '%' + Search + '%').orWhere('price', 'like', '%' + Search + '%')
                  .orWhere('call_duration', 'like', '%' + Search + '%').orWhere('feedback', 'like', '%' + Search + '%')
                  .orWhere('rating', 'like', '%' + Search + '%').orWhere('mentor.first_name', 'like', '%' + Search + '%')
                  .orWhere('mentor.last_name', 'like', '%' + Search + '%').orWhere('mentor.mobile_no', 'like', '%' + Search + '%')
                  .orWhere('mentor.email', 'like', '%' + Search + '%').orWhere('mentee.first_name', 'like', '%' + Search + '%')
                  .orWhere('mentee.last_name', 'like', '%' + Search + '%').orWhere('mentee.mobile_no', 'like', '%' + Search + '%')
                  .orWhere('mentee.email', 'like', '%' + Search + '%').orWhere('mentee.organisation', 'like', '%' + Search + '%')
                  .orWhere('appointments.expectation', 'like', '%' + Search + '%')
            })
          }
        }).orderBy(Sort_By, Order_by)
        .paginate(Page/Limit+1,Limit)
        .then(result => {
          result=result.toJSON();
          return response.status(200).send({
            status: true,
            message: "Pagination List of all Appointments with filter",
            data: {
              "rows":result.data,
              "total":result.total,
              "totalNotFiltered":result.total
            }
          });
        })
        .catch(err => {
          return response.status(400).json({
            status: false,
            message: "something went wrong",
            error: err,
          })
        })
  }

  async userSubscription({ request, response }) {
    const data = await UserSubscription.query()
      .with("user", (data) => {
        data.select('id','email')
      })
      .fetch();

    return response.status(200).send({
      status: true,
      message: "Appointments",
      data: data
    });
  }
  async userSubscriptionList({ request, response }) {
    let inputs = request.all();
    let Search=inputs.search || null;let Page=inputs.offset || 1;
    let Limit=inputs.limit || 10;let Sort_By=inputs.sort||'id';let Order_by=inputs.order||'asc';
    await UserSubscription.query()
        .leftJoin('users', 'user_subscriptions.user_id', 'users.id')
        .select('user_subscriptions.id','user_id','user_subscriptions.subscription_plan_id','Order_id','transaction_id','valid_till','remarks',
            'invoice_no','users.id as userId','users.email')
        .where((query) => {
          if(Search){
            query.andWhere(q => {
              q.orWhere('user_subscriptions.id', 'like', '%' + Search + '%')
                  .orWhere('user_subscriptions.user_id', 'like', '%' + Search + '%')
                  .orWhere('user_subscriptions.subscription_plan_id', 'like', '%' + Search + '%')
                  .orWhere('user_subscriptions.Order_id', 'like', '%' + Search + '%')
                  .orWhere('user_subscriptions.transaction_id', 'like', '%' + Search + '%')
                  .orWhere('user_subscriptions.valid_till', 'like', '%' + Search + '%')
                  .orWhere('user_subscriptions.remarks', 'like', '%' + Search + '%')
                  .orWhere('user_subscriptions.invoice_no', 'like', '%' + Search + '%')

                  .orWhere('users.email', 'like', '%' + Search + '%')
            })
          }
        }).orderBy(Sort_By, Order_by)
        .paginate(Page/Limit+1,Limit)
        .then(result => {
          result=result.toJSON();
          return response.status(200).send({
            status: true,
            message: "Pagination List of all users subscription with filter",
            data: {
              "rows":result.data,
              "total":result.total,
              "totalNotFiltered":result.total
            }
          });
        })
        .catch(err => {
          return response.status(400).json({
            status: false,
            message: "something went wrong",
            error: err,
          })
        })
  }

  async youtubeAssetSubscription({ request, response }) {
    try {
      const data = await UserYoutubeVideo.query()
          .with("user", (data) => {
            data.select('id','email')
          })
          .fetch();

      return response.status(200).send({
        status: true,
        message: "Youtube Purchase",
        data: data
      });
    }catch (error){
      // console.log("Error in youtubeAssetSubscription",error)
      return response.status(400).send({
        status:false,
        message:`Something Went Wrong!`
      })
    }
  }
  async youtubeAssetSubscriptionList({ request, response }) {
    let inputs = request.all();
    let Search=inputs.search || null;let Page=inputs.offset || 1;let Filter=inputs.filter || null;
    let Limit=inputs.limit || 10;let Sort_By=inputs.sort||'id';let Order_by=inputs.order||'asc';
    Filter=(Filter !== 'undefined') ? JSON.parse(Filter) : null;
    await UserYoutubeVideo.query()
        .leftJoin('users', 'user_youtube_videos.user_id', 'users.id')
        .select('user_youtube_videos.id','user_youtube_videos.youtube_videos_id','user_id','user_youtube_videos.from_date','user_youtube_videos.to_date',
            'user_youtube_videos.transaction_id','user_youtube_videos.order_id','user_youtube_videos.created_at','user_youtube_videos.updated_at',
            'users.id as userId','users.email')
        .where((query) => {
          if(Search){
            query.andWhere(q => {
              q.orWhere('user_youtube_videos.id', 'like', '%' + Search + '%')
                  .orWhere('user_youtube_videos.youtube_videos_id', 'like', '%' + Search + '%')
                  .orWhere('user_youtube_videos.user_id', 'like', '%' + Search + '%')
                  .orWhere('user_youtube_videos.from_date', 'like', '%' + Search + '%')
                  .orWhere('user_youtube_videos.to_date', 'like', '%' + Search + '%')
                  .orWhere('user_youtube_videos.transaction_id', 'like', '%' + Search + '%')
                  .orWhere('user_youtube_videos.order_id', 'like', '%' + Search + '%')
                  .orWhere('user_youtube_videos.updated_at', 'like', '%' + Search + '%')
                  .orWhere('users.email', 'like', '%' + Search + '%')
            })
          }
        }).orderBy(Sort_By, Order_by)
        .paginate(Page/Limit+1,Limit)
        .then(result => {
          result=result.toJSON();
          return response.status(200).send({
            status: true,
            message: "Pagination List of all youtube purchase with filter",
            data: {
              "rows":result.data,
              "total":result.total,
              "totalNotFiltered":result.total
            }
          });
        })
        .catch(err => {
          return response.status(400).json({
            status: false,
            message: "something went wrong",
            error: err,
          })
        })
  }
  async getAppointmentByRoomId({ request, response,auth,params }) {
    try {
      let data = await Appointment.query()
          .with("menteeUser")
          .with("mentorUser")
          .with('callDetails')
          .where({'room_id':params.room_id})
          .limit(1).orderBy('id', 'desc').fetch();
      return response.status(200).send({
        status: true,
        message: "Appointments Detail",
        data: data
      });
    } catch (error) {
      return response.status(400).send({
        status: false,
        message: `Something Went Wrong!`
      })
    }
  }
  async updateAppointment({ request, response, params }) {
    var rules = {
      status: "in:COMPLETED,PENDING,DISPUTED"
    };

    const validation = await this.validate(request, response, rules);
    if (validation.fails()) {
        return response.status(422).send({
            status: false,
            message: validation.messages()[0].message,
            hint: validation.messages()
        })
    }

    var inputs = request.only(["status"]);

    var update = await Appointment.query()
      .where({ id: params.id })
      .update(inputs);

    return response.status(201).send({
      status: true,
      message: "status updated",
      data: update
    });
  }

  async getPlans({ request, response, params }) {
    const data = await SubscriptionPlans.all();
    return response.status(201).send({
      status: true,
      message: "status updated",
      data
    });
  }
  async getPlansList({ request, response }) {
    let inputs = request.all();
    let Search=inputs.search || null;let Page=inputs.offset || 1;let Limit=inputs.limit || 10;
    await SubscriptionPlans.query()
        .select('id','name','description','frequency','category','interval','price','discount_amount','usd_price','usd_discount')
        .where((query) => {
          if(Search){
            query.andWhere(q => {
              q.orWhere('id', 'like', '%' + Search + '%').orWhere('name', 'like', '%' + Search + '%')
                  .orWhere('description', 'like', '%' + Search + '%').orWhere('frequency', 'like', '%' + Search + '%')
                  .orWhere('category', 'like', '%' + Search + '%').orWhere('interval', 'like', '%' + Search + '%')
                  .orWhere('price', 'like', '%' + Search + '%').orWhere('discount_amount', 'like', '%' + Search + '%')
                  .orWhere('usd_price', 'like', '%' + Search + '%').orWhere('usd_discount', 'like', '%' + Search + '%')
            })
          }
        })
        .paginate(Page/Limit+1,Limit)
        .then(result => {
          result=result.toJSON();
          return response.status(200).send({
            status: true,
            message: "Pagination List of all Subscription Plans",
            data: {
              "rows":result.data,
              "total":result.total,
              "totalNotFiltered":result.total
            }
          });
        })
        .catch(err => {
          return response.status(400).json({
            status: false,
            message: "something went wrong",
            error: err,
          })
        })
  }

  async updateMentor({ request, response, auth }) {
    let rules = {
      mentor_type: "in:STUDENT,ENTREPRENEUR,PROFESSIONAL",
      mentor_cost: "number",
      cost_frequency: "number",
      mentor_rating: "number",
      mentor_reveiw: "string",
      promo_video_assets_id: "string",
      linkedin_url: "string",
      facebook_url: "string",
      mentor_usd_cost: "number"
    };

    const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        
    let inputs = request.only([
      "mentor_type",
      "mentor_cost",
      "cost_frequency",
      "mentor_rating",
      "mentor_reveiw",
      "promo_video_assets_id",
      "linkedin_url",
      "facebook_url",
      "mentor_usd_cost"
    ]);
    let value = request.only("id");

    var updatedMentor = await Mentor.query()
      .where({ user_id: value.id })
      .update(inputs);

    return response.status(201).send({
      status: true,
      message: "User updated successfully",
      data: updatedMentor
    });
  }

  async createUserInterest({ request, response, auth }) {
    try {
      let inputs = request.only(["user_interests", "id"]);
      await UserInterest.query()
          .where("user_id", inputs.id)
          .delete();
      if (inputs.user_interests){
        let masterInterest = await InterestMaster.query()
            .whereIn("id", inputs.user_interests)
            .fetch();
        masterInterest = masterInterest.toJSON();
        const insertArray = masterInterest.map(m => {
          let value = {};
          value.user_id = inputs.id;
          value.user_interests = m.interest_name;
          value.master_interest_id = m.id;
          return value;
        });
        await UserInterest.createMany(insertArray);
      }
      return response.status(201).json({
        status: true,
        message: "User interest creation Successful"
      });
    }catch (e) {
      return response.status(400).json({
        status: false,
        message: "Something went wrong!"
      });
    }
  }

  async getMentor({ request, response, params, auth }) {
    var mentor = await Mentor.findBy({ user_id: params.id });
    return response.status(200).send({
      status: true,
      message: "Mentor profile",
      data: mentor
    });
  }

  async getAsset({ params, request, response }) {
    const getassets = await AssetsMasterModel.query()
      .where({ id: params.id })
      .fetch();
    return response.status(200).json({
      status: true,
      data: getassets
    });
  }

  async blockUnblockUser({ params, request, response }) {
    var user = await User.findBy({id:params.id});
    
    if(user.deleted_by == null){
      await User.query().where({id:params.id}).update({deleted_by:request.input('by')});
    }else{
      await User.query().where({id:params.id}).update({deleted_by:null});
    }

    return response.status(200).json({
      status: true,
      data: 'User Blocked Successfully'
    });
  }

  async getUserAccessTypes({ request, response }){
    const UserAccessType = use('App/Models/UserAccessType');
    let data = await UserAccessType.all();
    return response.status(200).json({
      status: true,
      data: data
    });
  }

// bulk uploading Starts



async bulkUploading({ request, response, auth }) {
    const profilePic = request.file('bulkupload');
  csv.parseFile(profilePic.tmpPath, { headers: true })
  .on("data", async function(data){
   // console.log(data);
   try {
   
  var userDetail = await User.create(data);
  // console.log("userDetail");
  // console.log(userDetail.id, userDetail.first_name);
    } 
    catch(err){
      // console.log(err)

    }
  })

  return response.status(200).send({
    status: true,
    message: "User detail updated successfully"
  });
}

  // bulk uploading ends



  async directOnboarding({ request, response, auth }) {
    let rules = {
      username: 'required|unique:users',
      mobile_no: 'required|number|min:7|max:15|unique:users',
      email: 'required|email|unique:users',
      password: 'min:6',
      password_confirmation: 'same:password',
      user_type: 'required|in:MENTOR,MENTEE',
      user_categories: 'required',
      first_name: 'required',
      last_name: 'required',
      country_id: 'required',
      org_id: 'required',
      organisation: 'required',
      gender:'required'
    }

    const validation = await this.validate(request, response, rules);
    if (validation.fails()) {
        return response.status(422).send({
            status: false,
            message: validation.messages()[0].message,
            hint: validation.messages()
        })
    }

    const inputs = request.only([
      'username',
      'mobile_no',
      'email',
      'password',
      'user_type',
      'name',
      'first_name',
      'last_name',
      'country_id',
      "org_id",
      "organisation",
      "gender"
    ])

    let _t = request.input('user_categories');
    if(!Array.isArray(_t)){
      _t = [_t]
    }
    inputs['user_category'] = _t[0];
    inputs['user_categories'] = _t.join();
    inputs.mobile_verified = 1;

    // console.log("Direct Onboarding ", inputs);
    
    let currentUser = await User.findOrCreate(inputs);
    Event.emit('new::user', currentUser);
    // console.log("check if currentUser empty or not ", currentUser)
    let data={}
    data.user_id = currentUser.id;
    let userprofile = await UserProfile.findOrCreate(data);

    const MentorModel = use('App/Models/Mentor');

    if(request.input('appointment_price')){
      await MentorModel.query().where({user_id: currentUser.id}).update({mentor_cost: request.input('appointment_price'), mentor_usd_cost: request.input('mentor_usd_cost')});
    }

    const UserAccessTypeMapping = use('App/Models/UserAccessTypeMapping');

    let _userAccess = [];
    let _userAccessIds = request.input('user_access_types');


    if(!Array.isArray(_userAccessIds)){
      _userAccessIds = [_userAccessIds]
    }

    _userAccessIds.map((item) => {
      _userAccess.push({
        user_id: currentUser.id,
        user_access_type_id: item
      });
    });
    
    await UserAccessTypeMapping.createMany(_userAccess);
    return response.status(201).json({
      status: true,
      message: "User Registration Successful",
      data: {
        currentUser
      }
    });

  }

  async updateMentorAdditionalDetails({ request, response, auth }){

    let rules = {
      appointment_price: 'required',
      mentor_id: 'required'
    }

    const validation = await this.validate(request, response, rules);
    if (validation.fails()) {
        return response.status(422).send({
            status: false,
            message: validation.messages()[0].message,
            hint: validation.messages()
        })
    }
      
    let mentor_id = request.input('mentor_id');

    const MentorModel = use('App/Models/Mentor');

    if(request.input('appointment_price')){
      await MentorModel.query().where({user_id: mentor_id}).update({mentor_cost: request.input('appointment_price'), mentor_usd_cost: request.input('mentor_usd_cost')});
    }


    let _t = request.input('user_categories') || [];

    if(!Array.isArray(_t)){
      _t = [_t];
    }

    _t = _t.join();

    const user = await User.find(mentor_id);
    user.user_categories = _t;
    await user.save();

    
    const UserAccessTypeMapping = use('App/Models/UserAccessTypeMapping');

    let _userAccess = [];
    let _userAccessIds = request.input('user_access_types') || [];

    if(!Array.isArray(_userAccessIds) && _userAccessIds){
      _userAccessIds = [_userAccessIds]
    }

    _userAccessIds.map((item) => {
      _userAccess.push({
        user_id: mentor_id,
        user_access_type_id: item
      });
    });

    await UserAccessTypeMapping.query().where({user_id: mentor_id}).delete();
    await UserAccessTypeMapping.createMany(_userAccess);
    
    return response.status(200).json({
      status: true,
      message: "Mentor Additional Data Updated Successfully",
      data: {
        userAccessIds: _userAccess
      }
    });

  }




  async youtubeUpload({ request, response, auth }){
    let rules = {
       user_id: 'required',
       video_title: 'required',
       url: 'required',
       owner: 'required',
       video_type: 'required|in:LIVE,RECORDED',
       demo_date: 'required',
       demo_time: 'required',
       user_category: 'required',
       price_INR: 'required',
       price_USD: 'required',
       access_type: 'required',
       from_date: 'required',
       to_date: 'required',

     }
     const validation = await this.validate(request, response, rules);
     if (validation.fails()) {
         return response.status(422).send({
             status: false,
             message: validation.messages()[0].message,
             hint: validation.messages()
         })
     }

     let inputs = request.only([
       'user_id',
       'video_title',
       'url',
       'owner',
       'video_type',
       'demo_date',
       'demo_time',
       'user_category',
       'price_INR',
       'price_USD',
       'access_type',
       'from_date',
       'to_date'
     ]);
     let _t = request.input('user_category');
    
    if(!Array.isArray(_t)){
      _t = [_t]
    } 
    inputs['user_category'] = _t.join();
var user = await User.findBy({email:inputs['user_id']});
inputs.user_id = user.id;
let currentUser =  await YoutubeVideo.create(inputs);
     
     return response.status(201).json({
       status: true,
       message: "Successful",
       data: currentUser
     });

}



//payment gateways apis started

async paymentAllGateways({request,response,auth}){
  let inputs = request.all();
  let Search=inputs.search || null;let Page=inputs.offset || 1;let Limit=inputs.limit || 10;
  await PaymentGatewayModel.query()
      .select('id','name','value','description','access','status')
      .where((query) => {
        if(Search){
          query.andWhere(q => {
            q.orWhere('id', 'like', '%' + Search + '%').orWhere('name', 'like', '%' + Search + '%')
                .orWhere('value', 'like', '%' + Search + '%').orWhere('description', 'like', '%' + Search + '%')
                .orWhere('access', 'like', '%' + Search + '%').orWhere('status', 'like', '%' + Search + '%')
          })
        }
      })
      .paginate(Page/Limit+1,Limit)
      .then(result => {
        result=result.toJSON();
        return response.status(200).send({
          status: true,
          message: "Pagination List of all paymeny gateways",
          data: {
            "rows":result.data,
            "total":result.total,
            "totalNotFiltered":result.total
          }
        });
      })
      .catch(err => {
        return response.status(400).json({
          status: false,
          message: "something went wrong",
          error: err,
        })
      })
}


async gatewayById({ request, response, auth, params }){
  const getassets = await PaymentGatewayModel.findBy({id:params.id});
  return response.status(200).json({
    status: true,
    data: getassets
  });
}


async updateGateways({ request, response, params }){
  let rules = {
      name: 'required',
    //  value: 'required',
      description: 'required',
      access: 'required',
      status: 'required',
    }
    const validation = await this.validate(request, response, rules);
    if (validation.fails()) {
        return response.status(422).send({
            status: false,
            message: validation.messages()[0].message,
            hint: validation.messages()
        })
    }
    let inputs = request.only([
      'name',
     // 'value',
      'description',
      'access',
      'status'
    ]);
      let _asset = await PaymentGatewayModel.findOrFail(params.id);
      await PaymentGatewayModel.query().where('id', _asset.id).update(inputs);
      _asset.name = inputs.name
    //  _asset.value = inputs.value
      _asset.description = inputs.description
      _asset.access = inputs.access
      _asset.status = inputs.status
      
      await _asset.save()
    return response.status(201).json({
      status: true,
      message: "Course update Successful",
      data: _asset
    });
}

//payment gateways apis Ends



async getCountries({request,response,auth}){
  const country = await Database.select('*').from('country');
//console.log(country)
  //country= country.toJSON();
      return response.status(200).send({
          status : true,
          message : "country List",
          data : country
      })
}

  async getMentorAccess({request,response,auth}){
    // let AccessList = await Database.raw(`
    //   SELECT t1.id, t1.country_id AS country_access_id, c1.name AS country_access,
    //   t1.org_id, c2.org_name, t1.mentor_id, t2.email, t2.username, t2.email,
    //   t2.first_name, t2.last_name, t2.mobile_no, t2.country_id as local_country_id
    //   FROM mentorkart.mentor_country_orgs AS t1
    //   LEFT JOIN mentorkart.users AS t2 ON t1.mentor_id=t2.id
    //   LEFT JOIN mentorkart.country AS c1 ON t1.country_id=c1.id
    //   LEFT JOIN mentorkart.org_masters AS c2 ON t1.org_id=c2.id;`);
    let inputs = request.all();
    let Search=inputs.search || null;let Page=inputs.offset || 1;let Limit=inputs.limit || 10;
    await MentorCountryOrg.query()
        .select('mentor_country_orgs.id', 'mentor_country_orgs.country_id AS country_access_id', 'country.name AS country_access',
        'mentor_country_orgs.org_id', 'org_masters.org_name', 'mentor_country_orgs.mentor_id', 'users.email', 'users.username', 'users.email',
        'users.first_name', 'users.last_name', 'users.mobile_no', 'users.country_id as local_country_id')
        .leftJoin('users', 'mentor_country_orgs.mentor_id', 'users.id')
        .leftJoin('country', 'mentor_country_orgs.country_id', 'country.id')
        .leftJoin('org_masters', 'mentor_country_orgs.org_id', 'org_masters.id')
        .where((query) => {
          if(Search){
            query.andWhere(q => {
              q.orWhere('mentor_country_orgs.id', 'like', '%' + Search + '%')
                  .orWhere('mentor_country_orgs.country_id', 'like', '%' + Search + '%').orWhere('country.name', 'like', '%' + Search + '%')
                  .orWhere('mentor_country_orgs.org_id', 'like', '%' + Search + '%').orWhere('org_masters.org_name', 'like', '%' + Search + '%')
                  .orWhere('mentor_country_orgs.mentor_id', 'like', '%' + Search + '%').orWhere('users.email', 'like', '%' + Search + '%')
                  .orWhere('users.username', 'like', '%' + Search + '%').orWhere('users.email', 'like', '%' + Search + '%')
                  .orWhere('users.first_name', 'like', '%' + Search + '%').orWhere('users.last_name', 'like', '%' + Search + '%')
                  .orWhere('users.mobile_no', 'like', '%' + Search + '%').orWhere('users.country_id', 'like', '%' + Search + '%')
            })
          }
        })
        .paginate(Page/Limit+1,Limit)
        .then(result => {
          result=result.toJSON();
          return response.status(200).send({
            status: true,
            message: "Pagination List of all Mentor Access",
            data: {
              "rows":result.data,
              "total":result.total,
              "totalNotFiltered":result.total
            }
          });
        })
        .catch(err => {
          return response.status(400).json({
            status: false,
            message: "something went wrong",
            error: err,
          })
        })
  }

  async mentorAccessDelete({ request, response, auth }){
 
    if(!request.input('asset_id')){
        return response.status(400).send({
          status: false,
          message: 'Identifier missing'
        })
      }
      //console.log("Deleting Asset With Name ", request.input('asset_id'))
      var deletedassets = await MentorCountryOrg.query().where('id', request.input('asset_id')).delete();
      // await deletedassets.delete();
      if (!deletedassets) {
        return response.status(400).json({
          status: false,
          message: "Asset not found",
          data: {
            deletedassets
          }
        });
      }
      return response.status(200).json({
        status: true,
        message: "Asset deleted Successful",
        data:deletedassets
      });
  }


  async addMentorCountryAccess({ request, response, auth }){
    let rules = {
      mentor_id: 'required',
      country_id: 'required',
      org_id: 'required'
     }
    const validation = await this.validate(request, response, rules);
    if (validation.fails()) {
      return response.status(422).send({
        status: false,
        message: validation.messages()[0].message,
        hint: validation.messages()
      })
    }
    let inputs = request.only([
      'mentor_id',
      'country_id',
      'org_id'
    ]);
    let userAccess =  await MentorCountryOrg.create(inputs);
    return response.status(201).json({
      status: true,
      message: "Successful",
      data: userAccess
    });
}



// user_experience start


async getUserExperience({ request, response, auth }){
let userExperience = await UserExperience.query().with('user').orderBy('created_at', 'desc').fetch();
userExperience = userExperience.toJSON();

return response.status(200).send({
  status:true,
  message:"List of All userExperience",
  data:userExperience
})
}
async getUserExperienceList({ request, response, auth }){
  let inputs = request.all();
  let Search=inputs.search || null;let Page=inputs.offset || 1;let Limit=inputs.limit || 10;let Sort_By=inputs.sort||'user_experiences.created_at';
  let Order_by=inputs.order||'desc';
  await UserExperience.query()
      .leftJoin('users', 'user_experiences.user_id', 'users.id')
      .select('user_experiences.id','title','user_id','user_experiences.organisation','description','start_date','end_date','users.email')
      .where((query) => {
        if(Search){
          query.andWhere(q => {
            q.orWhere('user_experiences.id', 'like', '%' + Search + '%')
                .orWhere('title', 'like', '%' + Search + '%')
                .orWhere('user_id', 'like', '%' + Search + '%')
                .orWhere('user_experiences.organisation', 'like', '%' + Search + '%')
                .orWhere('description', 'like', '%' + Search + '%')
                .orWhere('start_date', 'like', '%' + Search + '%')
                .orWhere('end_date', 'like', '%' + Search + '%')
                .orWhere('users.email', 'like', '%' + Search + '%')
          })
        }
      }).orderBy(Sort_By, Order_by)
      .paginate(Page/Limit+1,Limit)
      .then(result => {
        result=result.toJSON();
        return response.status(200).send({
          status: true,
          message: "Pagination List of all user experience with filter",
          data: {
            "rows":result.data,
            "total":result.total,
            "totalNotFiltered":result.total
          }
        });
      })
      .catch(err => {
        return response.status(400).json({
          status: false,
          message: "something went wrong",
          error: err,
        })
      })
}


async addUserExperience({ request, response, auth }){

let rules = {
  user_id: 'required',
  title: 'required',
  organisation: 'required',
  start_date: 'required',
  end_date: 'required'
}

const validation = await this.validate(request, response, rules);
if (validation.fails()) {
    return response.status(422).send({
        status: false,
        message: validation.messages()[0].message,
        hint: validation.messages()
    })
}
// console.log("inputs");
let inputs = request.only([
  'user_id',
  'title',
  'organisation',
  'description',
  'start_date',
  'end_date'
]);

let userExperienceAdd =  await UserExperience.create(inputs);

return response.status(200).send({
  status:true,
  message:"User Experience Created Successfully ",
  data:userExperienceAdd
})
}


async userExperienceDelete({ request, response, auth }){

if(!request.input('user_experience_id')){
    return response.status(400).send({
      status: false,
      message: 'Identifier missing'
    })
  }
  // console.log("Deleting Course With Name ", request.input('user_experience_id'))
  var deletedassets = await UserExperience.query().where('id', request.input('user_experience_id')).delete();
  // await deletedassets.delete();
  if (!deletedassets) {
    return response.status(400).json({
      status: false,
      message: "User Experience not found",
      data: {
        deletedassets
      }
    });
  }
  return response.status(200).json({
    status: true,
    message: "User Experience deleted Successful",
    data:deletedassets
  });
}


async userExperienceById({ request, response, auth, params }){
  let getassets = await UserExperience.query().where({id:params.id}).with('user').fetch();
  if (getassets.rows.length){
    getassets=getassets.toJSON();
    getassets=getassets[0];
    getassets.start_date = moment(getassets.start_date).format('YYYY-MM-DD');
    getassets.end_date = moment(getassets.end_date).format('YYYY-MM-DD');
  }
  return response.status(200).json({
    status: true,
    data: getassets
  });
}

async userExperienceUpdate({ request, response, params }){
  let rules = {
    title: 'required',
    organisation: 'required',
    start_date: 'required',
    end_date: 'required'
  }
  const validation = await this.validate(request, response, rules);
  if (validation.fails()) {
      return response.status(422).send({
          status: false,
          message: validation.messages()[0].message,
          hint: validation.messages()
      })
  }
  let inputs = request.only([
    'title',
    'organisation',
    'description',
    'start_date',
    'end_date'
  ]);
  let _asset = await UserExperience.findOrFail(params.id);
  await UserExperience.query().where('id', _asset.id).update(inputs);
    _asset.title = inputs.title
    _asset.organisation = inputs.organisation
    _asset.description = inputs.description
    _asset.start_date = inputs.start_date
    _asset.end_date = inputs.end_date
  await _asset.save()
  return response.status(201).json({
    status: true,
    message: "User Experience update Successful",
    data: _asset
  });
}

// user_exprience end



// user_achievemnt start


async getUserAchievement({ request, response, auth }){
  let inputs = request.all();
  let Search=inputs.search || null;let Page=inputs.offset || 1;let Limit=inputs.limit || 10;
  await UserAchievement.query()
      .select('id','user_id','name','description','year')
      .where((query) => {
        if(Search){
          query.andWhere(q => {
            q.orWhere('id', 'like', '%' + Search + '%')
                .orWhere('user_id', 'like', '%' + Search + '%').orWhere('name', 'like', '%' + Search + '%')
                .orWhere('description', 'like', '%' + Search + '%').orWhere('year', 'like', '%' + Search + '%')
          })
        }
      }).orderBy('created_at', 'desc')
      .paginate(Page/Limit+1,Limit)
      .then(result => {
        result=result.toJSON();
        return response.status(200).send({
          status: true,
          message: "Pagination List of all user achievement",
          data: {
            "rows":result.data,
            "total":result.total,
            "totalNotFiltered":result.total
          }
        });
      })
      .catch(err => {
        return response.status(400).json({
          status: false,
          message: "something went wrong",
          error: err,
        })
      })
  }
  
  
  async addUserAchievement({ request, response, auth }){
  
  let rules = {
    user_id: 'required',
    description: 'required',
    name: 'required',
    year: 'required'
  }
  
  const validation = await this.validate(request, response, rules);
  if (validation.fails()) {
      return response.status(422).send({
          status: false,
          message: validation.messages()[0].message,
          hint: validation.messages()
      })
  }
  // console.log("inputs");
  let inputs = request.only([
    'user_id',
    'description',
    'name',
    'year'
  ]);
  
  let UserAchievementAdd =  await UserAchievement.create(inputs);
  
  return response.status(200).send({
    status:true,
    message:"Add UserAchievement",
    data:UserAchievementAdd
  })
  }
  
  
  async userAchievementDelete({ request, response, auth }){
  
  if(!request.input('user_achievement_id')){
      return response.status(400).send({
        status: false,
        message: 'Identifier missing'
      })
    }
    // console.log("Deleting Course With Name ", request.input('user_achievement_id'))
    var deletedassets = await UserAchievement.query().where('id', request.input('user_achievement_id')).delete();
    // await deletedassets.delete();
    if (!deletedassets) {
      return response.status(400).json({
        status: false,
        message: "UserAchievement not found",
        data: {
          deletedassets
        }
      });
    }
    return response.status(200).json({
      status: true,
      message: "UserAchievement deleted Successful",
      data:deletedassets
    });
  }
  
  
  async userAchievementById({ request, response, auth, params }){
    const getassets = await UserAchievement.findBy({id:params.id});
    //console.log(getassets, "getassestes");
    return response.status(200).json({
      status: true,
      data: getassets
    });
  }
  
  async userAchievementUpdate({ request, response, params }){
    let rules = {
      description: 'required',
      name: 'required',
      year: 'required'
    }
    const validation = await this.validate(request, response, rules);
    if (validation.fails()) {
        return response.status(422).send({
            status: false,
            message: validation.messages()[0].message,
            hint: validation.messages()
        })
    }
    let inputs = request.only([
      'description',
      'name',
      'year'
    ]);
    let _asset = await UserAchievement.findOrFail(params.id);
    await UserAchievement.query().where('id', _asset.id).update(inputs);
      _asset.description = inputs.description
      _asset.name = inputs.name
      _asset.year = inputs.year
    await _asset.save()
    return response.status(201).json({
      status: true,
      message: "UserAchievement update Successful",
      data: _asset
    });
  }
  
  // user_Achievement end


  // user_testimonial start


async getUserTestimonial({ request, response, auth }){
  let inputs = request.all();
  let Search=inputs.search || null;let Page=inputs.offset || 1;let Limit=inputs.limit || 10;
  await UserTestimonial.query()
      .select('id','user_id','given_by','description','year')
      .where((query) => {
        if(Search){
          query.andWhere(q => {
            q.orWhere('id', 'like', '%' + Search + '%').orWhere('user_id', 'like', '%' + Search + '%')
                .orWhere('given_by', 'like', '%' + Search + '%').orWhere('description', 'like', '%' + Search + '%')
                .orWhere('year', 'like', '%' + Search + '%')
          })
        }
      }).orderBy('created_at', 'desc')
      .paginate(Page/Limit+1,Limit)
      .then(result => {
        result=result.toJSON();
        return response.status(200).send({
          status: true,
          message: "Pagination List of all UserTestimonial",
          data: {
            "rows":result.data,
            "total":result.total,
            "totalNotFiltered":result.total
          }
        });
      })
      .catch(err => {
        return response.status(400).json({
          status: false,
          message: "something went wrong",
          error: err,
        })
      })
  }
  
  
  async addUserTestimonial({ request, response, auth }){
  
  let rules = {
    user_id: 'required',
    description: 'required',
    given_by: 'required',
    year: 'required'
  }
  
  const validation = await this.validate(request, response, rules);
  if (validation.fails()) {
      return response.status(422).send({
          status: false,
          message: validation.messages()[0].message,
          hint: validation.messages()
      })
  }
  // console.log("inputs");
  let inputs = request.only([
    'user_id',
    'description',
    'given_by',
    'year'
  ]);
  
  let UserTestimonialAdd =  await UserTestimonial.create(inputs);
  
  return response.status(200).send({
    status:true,
    message:"Add UserTestimonial",
    data:UserTestimonialAdd
  })
  }
  
  
  async userTestimonialDelete({ request, response, auth }){
  
  if(!request.input('user_testimonial_id')){
      return response.status(400).send({
        status: false,
        message: 'Identifier missing'
      })
    }
    // console.log("Deleting Course With Name ", request.input('user_testimonial_id'))
    var deletedassets = await UserTestimonial.query().where('id', request.input('user_testimonial_id')).delete();
    // await deletedassets.delete();
    if (!deletedassets) {
      return response.status(400).json({
        status: false,
        message: "UserTestimonial not found",
        data: {
          deletedassets
        }
      });
    }
    return response.status(200).json({
      status: true,
      message: "UserTestimonial deleted Successful",
      data:deletedassets
    });
  }
  
  
  async userTestimonialById({ request, response, auth, params }){
    const getassets = await UserTestimonial.findBy({id:params.id});
    //console.log(getassets, "getassestes");
    return response.status(200).json({
      status: true,
      data: getassets
    });
  }
  
  async userTestimonialUpdate({ request, response, params }){
    let rules = {
      description: 'required',
      given_by: 'required',
      year: 'required'
    }
    const validation = await this.validate(request, response, rules);
    if (validation.fails()) {
        return response.status(422).send({
            status: false,
            message: validation.messages()[0].message,
            hint: validation.messages()
        })
    }
    let inputs = request.only([
      'description',
      'given_by',
      'year'
    ]);
    let _asset = await UserTestimonial.findOrFail(params.id);
    await UserTestimonial.query().where('id', _asset.id).update(inputs);
      _asset.description = inputs.description
      _asset.given_by = inputs.given_by
      _asset.year = inputs.year
    await _asset.save()
    return response.status(201).json({
      status: true,
      message: "UserTestimonial update Successful",
      data: _asset
    });
  }
  
  // user_testimonial end
  async userSequenceUpdate({ request, response, auth }){
    try {
      let rules = {
        id:'required',
        sequence:'required',
      }
      const validation = await this.validate(request, response, rules);
      if (validation.fails()) {
        return response.status(422).send({
          status: false,
          message: validation.messages()[0].message,
          hint: validation.messages()
        })
      }
      await User.query()
          .where('id', request.body.id)
          .update({sequence:request.body.sequence});
      return response.status(200).json({
        status: true,
        message: 'Sequence Updated Successfully'
      });
    }catch(error) {
      return response.status(400).send({
        status: false,
        message: 'Something Went wrong!'
      })
    }
  }
  async getTestResultUrl({ request, response, auth, params }){
    let req=request.all();
    let table;let detail;let name;let leadRec;
    table=(req.onboarding_type == 'Affiliate') ? Affiliate : (req.onboarding_type == 'University') ? University : (req.onboarding_type == 'ChannelPartners') ? ChannelPartner : (req.onboarding_type == 'Partner') ? Partner : null;
    if(table !== null && req.utm_medium != null) detail = await table.findBy({utm_medium:req.utm_medium});
    if(detail) name=(req.onboarding_type == 'Affiliate') ? detail.name : (req.onboarding_type == 'University') ? detail.university_name : (req.onboarding_type == 'ChannelPartners') ? detail.name : (req.onboarding_type == 'Partner') ? detail.brand_name : null;
    return response.status(200).json({
      status: true,
      data: {'test_result_url':(detail)?detail.test_result_url : null, 'name':name || null}
    });
  }

  
}

module.exports = AdminController;
