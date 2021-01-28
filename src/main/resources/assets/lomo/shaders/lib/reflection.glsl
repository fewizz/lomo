#include lomo:reflection_config

/* lomo:pipeline/lib/reflection.glsl */

sampler2D main_texs[TEX_COUNT];
sampler2D depth_texs[TEX_COUNT];

struct reflect_result {
	vec4 color;
	float ratio;
};

struct depth_retrieve_result {
	int index;
	float depth;
	sampler2D texture;
};

depth_retrieve_result find_closest(vec2 pos, float depth) {
	int tex_id = 0;
	sampler2D depth_t = depth_texs[tex_id];

	for(int i = TEX_COUNT - 1; i >= 0; i--) {
		float d = texture2D(depth_t, pos).r;
		if(d <= depth) {
			return depth_retrieve_result(i, d, depth_t);
		}
	}

	return depth_retrieve_result(-1, 1, depth_texs[0]);
}

reflect_result reflect(vec3 cam_s_position, vec3 reflection_dir, mat4 proj) {

	float cos_between_reflection_and_ray = dot(-normalize(cam_s_position), reflection_dir);
	float cos_between_normal_and_ray = sqrt((1 + cos_between_reflection_and_ray) / 2);
	float sin_between_normal_and_ray = sqrt(1 - cos_between_normal_and_ray*cos_between_normal_and_ray);//dot(camera_dir, reflection_dir);

	float step = abs(/*cam_s_position.z */ (1 / max(0.001, abs(cos_between_normal_and_ray))))/
#if REFLECTION_QUALITY == LOMO_REFLECTION_QUALITY_POTATO
		60
	#define MAX_STAGE 0
#elif REFLECTION_QUALITY == LOMO_REFLECTION_QUALITY_LOW
		100
	#define MAX_STAGE 0
#elif REFLECTION_QUALITY == LOMO_REFLECTION_QUALITY_MEDIUM
		120
	#define MAX_STAGE 4
#elif REFLECTION_QUALITY == LOMO_REFLECTION_QUALITY_HIGH
		140
	#define MAX_STAGE 8
#endif
		;

#if MAX_STAGE > 0
#define USE_STABILIZER
#endif

	float ray_len = -cam_s_position.z/50 + step;

#ifdef USE_STABILIZER
	float stage = -1;
#endif

	while(true) {
		ray_len += step;
		vec3 position = cam_s_position + reflection_dir*ray_len;

		if(position.z >= 0) break;

		vec3 win_s_position = cam_to_win(position, proj);
		vec2 tex_uv = win_s_position.xy / frxu_size;

		vec2 magic = (tex_uv - 0.5);
		float closeness_to_border = max(abs(magic.y), abs(magic.x)) * 2;
		if(closeness_to_border >= 1) break;

		depth_retrieve_result res = find_closest(tex_uv, win_s_position.z);//texture2D(u_input_depth, tex_uv).r;

		// We hit the ground
		//depth_retrieve_result res = //win_s_position.z - win_s_depth;
		float z_diff = win_s_position.z  = res.depth;
		if(res.index != -1 && z_diff > 0
#ifdef USE_STABILIZER
			|| stage >= MAX_STAGE
#endif
		) {
#ifdef USE_STABILIZER
			if(stage == -1) {
				ray_len = ray_len - step;
				step = step / MAX_STAGE;
				stage = 0;
				//continue; Won't work on amd cards...
			} else
#endif
			{
			
				//float world_z_diff = z_win_to_cam(win_s_depth, proj) - position.z;
				//ratio = clamp((ray_len/2 - world_z_diff)/step, 0, 1);

				// farness from borderreverting,
				// clamping, so that it will be close to 0 on borders, and 1 in center
				float ratio = clamp(1 - closeness_to_border*closeness_to_border, 0, 1);

				// apply angle, but we need sin
				ratio *= clamp(sin_between_normal_and_ray*1.5, 0, 1);
				/*reflection_color =*/return reflect_result(texture2D(main_texs[res.index], tex_uv), ratio);
				//break;
			}
		}

#ifdef USE_STABILIZER
		if(stage >= 0)
			++stage;
		else
#endif
			step += (
				step /
#if REFLECTION_QUALITY == LOMO_REFLECTION_QUALITY_POTATO
				8
#elif REFLECTION_QUALITY == LOMO_REFLECTION_QUALITY_LOW
				20
#elif REFLECTION_QUALITY == LOMO_REFLECTION_QUALITY_MEDIUM
				40
#elif REFLECTION_QUALITY == LOMO_REFLECTION_QUALITY_HIGH
				60
#endif
			);///; * abs(1/max(0.001, abs(cos_between_normal_and_ray)));
	}

	return reflect_result(vec4(0), 0);
}